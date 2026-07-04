from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.db.neo4j import get_driver
from app.services.graph.neo4j_ops import get_standard_edges, get_gap_edges, get_novel_edges

router = APIRouter()


@router.get("/{graph_id}/edges")
async def get_graph_edges(graph_id: str, user: dict = Depends(get_current_user)):
    driver = get_driver()
    async with driver.session() as session:
        edges = await get_standard_edges(session, graph_id)
    return edges


@router.get("/compare")
async def compare_graphs(standard_graph_id: str, student_graph_id: str, user: dict = Depends(get_current_user)):
    driver = get_driver()
    async with driver.session() as session:
        gaps = await get_gap_edges(session, standard_graph_id, student_graph_id)
        novel = await get_novel_edges(session, student_graph_id)
    return {"missed": gaps, "novel": novel}
