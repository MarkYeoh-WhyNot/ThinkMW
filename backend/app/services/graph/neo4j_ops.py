"""Neo4j graph operations — standard and student graph persistence."""
from uuid import UUID
from neo4j import AsyncSession


async def write_standard_graph(
    session: AsyncSession,
    topic_id: str,
    graph_id: str,
    nodes: list[dict],
    edges: list[dict],
) -> None:
    # Upsert concept nodes
    await session.run(
        """
        UNWIND $nodes AS n
        MERGE (c:Concept {id: n.id, topic_id: $topic_id})
        SET c.name = n.name,
            c.description = n.description,
            c.cluster = n.cluster
        """,
        nodes=nodes,
        topic_id=topic_id,
    )

    # Write standard edges
    await session.run(
        """
        UNWIND $edges AS e
        MATCH (src:Concept {id: e.source_id, topic_id: $topic_id})
        MATCH (tgt:Concept {id: e.target_id, topic_id: $topic_id})
        MERGE (src)-[r:RELATES {graph_id: $graph_id}]->(tgt)
        SET r.type = e.type,
            r.label = e.label,
            r.is_standard = true,
            r.is_novel = false
        """,
        edges=edges,
        topic_id=topic_id,
        graph_id=graph_id,
    )


async def write_student_edges(
    session: AsyncSession,
    topic_id: str,
    graph_id: str,
    edges: list[dict],
) -> None:
    await session.run(
        """
        UNWIND $edges AS e
        MATCH (src:Concept {id: e.source_node_id, topic_id: $topic_id})
        MATCH (tgt:Concept {id: e.target_node_id, topic_id: $topic_id})
        MERGE (src)-[r:RELATES {graph_id: $graph_id}]->(tgt)
        SET r.type = e.canonical_type,
            r.label = e.label,
            r.is_standard = false,
            r.is_novel = e.is_novel,
            r.llm_verdict = e.llm_verdict,
            r.similarity_score = e.similarity_score
        """,
        edges=edges,
        topic_id=topic_id,
        graph_id=graph_id,
    )


async def get_standard_edges(session: AsyncSession, graph_id: str) -> list[dict]:
    result = await session.run(
        """
        MATCH (src:Concept)-[r:RELATES {graph_id: $graph_id, is_standard: true}]->(tgt:Concept)
        RETURN src.id AS source_node_id, tgt.id AS target_node_id,
               r.type AS type, coalesce(r.valid_types, [r.type]) AS valid_types, r.label AS label
        """,
        graph_id=graph_id,
    )
    return [dict(record) async for record in result]


async def get_gap_edges(
    session: AsyncSession,
    standard_graph_id: str,
    student_graph_id: str,
) -> list[dict]:
    """Return edges in standard but NOT in student graph."""
    result = await session.run(
        """
        MATCH (src:Concept)-[r:RELATES {graph_id: $std_id}]->(tgt:Concept)
        WHERE NOT EXISTS {
            MATCH (src)-[s:RELATES {graph_id: $stu_id}]->(tgt)
        }
        RETURN src.id AS source_node_id, src.name AS source_name,
               src.cluster AS source_cluster,
               tgt.id AS target_node_id, tgt.name AS target_name,
               tgt.cluster AS target_cluster,
               r.label AS label, r.type AS type,
               coalesce(r.guiding_question, '') AS guiding_question
        """,
        std_id=standard_graph_id,
        stu_id=student_graph_id,
    )
    return [dict(record) async for record in result]


async def get_novel_edges(session: AsyncSession, student_graph_id: str) -> list[dict]:
    """Return edges student drew that are marked novel."""
    result = await session.run(
        """
        MATCH (src:Concept)-[r:RELATES {graph_id: $graph_id, is_novel: true}]->(tgt:Concept)
        RETURN src.id AS source_node_id, src.name AS source_name,
               tgt.id AS target_node_id, tgt.name AS target_name,
               r.label AS label, r.llm_verdict AS llm_verdict
        """,
        graph_id=student_graph_id,
    )
    return [dict(record) async for record in result]
