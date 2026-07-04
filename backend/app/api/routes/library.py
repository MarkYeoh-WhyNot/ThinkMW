from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.core.config import settings
from app.db.supabase import get_client

router = APIRouter()

_SCORE_WEIGHTS = {
    "coverage": settings.SCORE_WEIGHT_COVERAGE,
    "novel_valid": settings.SCORE_WEIGHT_NOVEL,
    "structure": settings.SCORE_WEIGHT_STRUCTURE,
    "completeness": settings.SCORE_WEIGHT_COMPLETENESS,
}


@router.get("/")
async def get_library(current_user: dict = Depends(get_current_user)):
    """Return all topics the student has attempted with per-attempt scores."""
    db = get_client()
    student_id = current_user["id"]

    # Fetch all sessions for this student that have been submitted
    sessions_result = db.table("graph_sessions") \
        .select("id, topic_id, submitted_at, hints_used, topics(id, title, subject)") \
        .eq("student_id", student_id) \
        .not_.is_("submitted_at", "null") \
        .order("submitted_at", desc=False) \
        .execute()

    sessions = sessions_result.data or []

    # Collect all session ids and fetch student_graphs (one row per attempt)
    session_ids = [s["id"] for s in sessions]
    if not session_ids:
        return {"topics": [], "weights": _SCORE_WEIGHTS}

    sg_result = db.table("student_graphs") \
        .select("session_id, score_total, score_breakdown, attempt_number, novel_edges_valid") \
        .in_("session_id", session_ids) \
        .order("attempt_number", desc=False) \
        .execute()

    # Index student_graphs by session_id
    sg_by_session: dict[str, list] = {}
    for sg in (sg_result.data or []):
        sg_by_session.setdefault(sg["session_id"], []).append(sg)

    # Group sessions by topic, building topic entries
    topics_map: dict[str, dict] = {}
    for s in sessions:
        topic = s["topics"]
        if not topic:
            continue
        tid = topic["id"]
        if tid not in topics_map:
            topics_map[tid] = {
                "topic_id": tid,
                "title": topic["title"],
                "subject": topic["subject"],
                "attempts": [],
                "last_attempted_at": None,
            }
        entry = topics_map[tid]
        for sg in sg_by_session.get(s["id"], []):
            entry["attempts"].append({
                "attempt_number": sg["attempt_number"],
                "score": round(sg["score_total"] * 100),
                "score_breakdown": sg["score_breakdown"],
                "novel_edges_valid": sg["novel_edges_valid"],
                "submitted_at": s["submitted_at"],
            })
        entry["last_attempted_at"] = s["submitted_at"]

    result_topics = []
    for entry in topics_map.values():
        scores = [a["score"] for a in entry["attempts"]]
        entry["best_score"] = max(scores) if scores else 0
        entry["attempt_count"] = len(entry["attempts"])
        result_topics.append(entry)

    # Sort: most recently attempted first
    result_topics.sort(key=lambda t: t["last_attempted_at"] or "", reverse=True)
    return {"topics": result_topics, "weights": _SCORE_WEIGHTS}
