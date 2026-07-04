import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.db.supabase import get_client
from app.db.neo4j import get_driver
from app.models.schemas import GraphSessionIn, GraphSessionOut, StudentGraphSubmission, GraphComparisonOut
from app.services.ai.semantic import map_label, judge_novel_edge
from app.services.graph.neo4j_ops import write_student_edges, get_standard_edges, get_gap_edges, get_novel_edges
from app.services.scoring.scorer import compute_score, check_merge_eligibility

router = APIRouter()


@router.post("/", response_model=GraphSessionOut)
async def start_session(
    body: GraphSessionIn,
    current_user: dict = Depends(get_current_user),
):
    db = get_client()
    session_id = str(uuid.uuid4())
    row = {
        "id": session_id,
        "topic_id": str(body.topic_id),
        "student_id": current_user["id"],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "hints_used": 0,
    }
    result = db.table("graph_sessions").insert(row).execute()
    return result.data[0]


@router.post("/{session_id}/submit", response_model=GraphComparisonOut)
async def submit_graph(
    session_id: str,
    body: StudentGraphSubmission,
    current_user: dict = Depends(get_current_user),
):
    db = get_client()

    # Fetch session + topic
    session = db.table("graph_sessions").select("*, topics(*)").eq("id", session_id).single().execute().data
    if session["student_id"] != current_user["id"]:
        raise HTTPException(403, "This session belongs to another student")
    topic = session["topics"]
    standard_graph_id = topic.get("neo4j_graph_id")
    if not standard_graph_id:
        raise HTTPException(400, "Standard graph not ready yet")

    student_graph_id = f"stu_{session_id}"

    # Process each edge through semantic layer
    processed_edges = []
    novel_edges = []

    # Fetch node names for context
    nodes_result = db.table("concept_nodes").select("id, canonical_name").eq("topic_id", topic["id"]).execute()
    node_map = {n["id"]: n["canonical_name"] for n in nodes_result.data}

    for edge in body.edges:
        src_name = node_map.get(str(edge.source_node_id), "unknown")
        tgt_name = node_map.get(str(edge.target_node_id), "unknown")

        mapping = map_label(edge.label, src_name, tgt_name, topic.get("subject", "general"))

        is_novel = mapping["route"] == "novel"
        llm_verdict = None
        if is_novel:
            llm_verdict = judge_novel_edge(edge.label, src_name, tgt_name, topic.get("subject", "general"))
            novel_edges.append({"verdict": llm_verdict})

        processed_edges.append({
            "source_node_id": str(edge.source_node_id),
            "target_node_id": str(edge.target_node_id),
            "label": edge.label,
            "justification": edge.justification,
            "canonical_type": mapping.get("canonical_type"),
            "similarity_score": mapping.get("similarity_score"),
            "is_novel": is_novel,
            "llm_verdict": llm_verdict.value if llm_verdict else None,
        })

    # Write student graph to Neo4j
    driver = get_driver()
    async with driver.session() as neo_session:
        await write_student_edges(neo_session, topic["id"], student_graph_id, processed_edges)
        std_edges = await get_standard_edges(neo_session, standard_graph_id)
        gap_edges = await get_gap_edges(neo_session, standard_graph_id, student_graph_id)
        novel_edge_data = await get_novel_edges(neo_session, student_graph_id)

    # Score
    novel_valid = sum(1 for e in novel_edges if e.get("verdict") == "valid")
    total_nodes = len(node_map)
    placed_node_ids = set()
    for e in body.edges:
        placed_node_ids.add(str(e.source_node_id))
        placed_node_ids.add(str(e.target_node_id))

    score = compute_score(
        standard_edges=std_edges,
        student_edges=processed_edges,
        novel_valid_count=novel_valid,
        novel_total_count=len(novel_edges),
        total_nodes=total_nodes,
        placed_nodes=len(placed_node_ids),
    )

    # Count prior attempts for this session
    prior = db.table("student_graphs").select("id", count="exact").eq("session_id", session_id).execute()
    attempt_number = (prior.count or 0) + 1

    # Save student graph record (one row per attempt)
    sg_id = str(uuid.uuid4())
    db.table("student_graphs").insert({
        "id": sg_id,
        "session_id": session_id,
        "neo4j_graph_id": f"{student_graph_id}_a{attempt_number}",
        "score_total": score.total,
        "score_breakdown": score.model_dump(),
        "novel_edges_valid": novel_valid,
        "merge_eligible": novel_valid > 0,
        "attempt_number": attempt_number,
    }).execute()

    # Mark session submitted (update timestamp each attempt)
    db.table("graph_sessions").update({
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", session_id).execute()

    return GraphComparisonOut(
        session_id=uuid.UUID(session_id),
        score=score,
        missed_edges=gap_edges,
        novel_edges=novel_edge_data,
        correct_edges=[e for e in processed_edges if not e["is_novel"] and
                       (e["source_node_id"], e["target_node_id"]) in
                       {(s["source_node_id"], s["target_node_id"]) for s in std_edges}],
        merge_eligible=novel_valid > 0,
        attempt_number=attempt_number,
    )


@router.post("/{session_id}/hint")
async def use_hint(session_id: str, current_user: dict = Depends(get_current_user)):
    """Reveal one missing connection (source node only)."""
    db = get_client()
    session = db.table("graph_sessions").select("hints_used, topic_id, student_id").eq("id", session_id).single().execute().data
    if session["student_id"] != current_user["id"]:
        raise HTTPException(403, "This session belongs to another student")
    topic = db.table("topics").select("neo4j_graph_id, settings").eq("id", session["topic_id"]).single().execute().data

    max_hints = (topic.get("settings") or {}).get("hint_tokens", 3)
    if session["hints_used"] >= max_hints:
        raise HTTPException(400, "No hint tokens remaining")

    # Find a missed edge and return only the source node
    driver = get_driver()
    async with driver.session() as neo_session:
        student_graph_id = f"stu_{session_id}"
        gaps = await get_gap_edges(neo_session, topic["neo4j_graph_id"], student_graph_id)

    if not gaps:
        raise HTTPException(400, "No missing edges to hint")

    db.table("graph_sessions").update({"hints_used": session["hints_used"] + 1}).eq("id", session_id).execute()

    # Rotate through gaps so repeated hints reveal different edges
    hint_edge = gaps[session["hints_used"] % len(gaps)]
    return {"hint_source_node_id": hint_edge["source_node_id"], "hint_source_name": hint_edge["source_name"]}
