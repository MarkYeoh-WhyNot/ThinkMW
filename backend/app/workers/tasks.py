"""Async Celery tasks — graph generation runs here, not on the request thread."""
import uuid
import fitz  # PyMuPDF
from app.workers.celery_app import celery_app
from app.services.ai.extractor import extract_graph_from_text
from app.db.supabase import get_client
from app.core.config import settings


@celery_app.task(bind=True, max_retries=3)
def generate_standard_graph(self, topic_id: str, file_path: str, title: str, subject: str):
    try:
        # 1. Read local PDF
        doc = fitz.open(file_path)
        raw_text = "\n".join(page.get_text() for page in doc)

        # 2. LLM extraction
        graph_data = extract_graph_from_text(title, subject, raw_text)

        # 3. Assign UUIDs to nodes here so we can reuse them for Supabase
        node_name_to_id = {n["name"]: str(uuid.uuid4()) for n in graph_data["nodes"]}
        hydrated_nodes = [{**n, "id": node_name_to_id[n["name"]]} for n in graph_data["nodes"]]
        hydrated_edges = [
            {
                "source_id": node_name_to_id[e["source"]],
                "target_id": node_name_to_id[e["target"]],
                "type": e["type"],
                "valid_types": e.get("valid_types") or [e["type"]],
                "label": e["label"],
                "guiding_question": e.get("guiding_question", ""),
            }
            for e in graph_data["edges"]
            if e["source"] in node_name_to_id and e["target"] in node_name_to_id
        ]

        # 4. Write to Neo4j
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        graph_id = f"std_{topic_id}"
        with driver.session() as neo_session:
            neo_session.execute_write(_write_graph_tx, topic_id, graph_id, hydrated_nodes, hydrated_edges)
        driver.close()

        # 5. Save concept nodes to Supabase for student tray
        db = get_client()
        supabase_nodes = [
            {
                "id": n["id"],
                "topic_id": topic_id,
                "canonical_name": n["name"],
                "description": n.get("description", ""),
                "cluster_tag": n.get("cluster"),
            }
            for n in hydrated_nodes
        ]
        if supabase_nodes:
            db.table("concept_nodes").insert(supabase_nodes).execute()

        # 6. Update topic status
        db.table("topics").update(
            {"status": "ready", "neo4j_graph_id": graph_id}
        ).eq("id", topic_id).execute()

    except Exception as exc:
        if self.request.retries >= self.max_retries:
            # Out of retries — mark the topic as failed so the teacher sees it
            db = get_client()
            db.table("topics").update({"status": "error"}).eq("id", topic_id).execute()
            raise
        raise self.retry(exc=exc, countdown=30)


def _write_graph_tx(tx, topic_id, graph_id, hydrated_nodes, hydrated_edges):
    tx.run(
        """
        UNWIND $nodes AS n
        MERGE (c:Concept {id: n.id})
        SET c.name = n.name, c.topic_id = $topic_id,
            c.description = n.description, c.cluster = n.cluster
        """,
        nodes=hydrated_nodes,
        topic_id=topic_id,
    )
    tx.run(
        """
        UNWIND $edges AS e
        MATCH (src:Concept {id: e.source_id})
        MATCH (tgt:Concept {id: e.target_id})
        MERGE (src)-[r:RELATES {graph_id: $graph_id}]->(tgt)
        SET r.type = e.type, r.valid_types = e.valid_types, r.label = e.label,
            r.guiding_question = e.guiding_question, r.is_standard = true
        """,
        edges=hydrated_edges,
        graph_id=graph_id,
    )
