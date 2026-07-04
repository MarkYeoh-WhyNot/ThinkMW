import uuid
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from app.core.auth import get_current_user, require_teacher
from app.core.config import settings
from app.db.supabase import get_client
from app.db.neo4j import get_driver
from app.workers.tasks import generate_standard_graph
from app.models.schemas import TopicOut

router = APIRouter()

UPLOAD_DIR = "/app/uploads"


@router.post("/", response_model=TopicOut)
async def create_topic(
    title: str = Form(...),
    class_id: str | None = Form(None),
    subject: str = Form(...),
    file: UploadFile = File(...),
    teacher: dict = Depends(require_teacher),
):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are accepted")

    topic_id = str(uuid.uuid4())
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, f"{topic_id}.pdf")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    db = get_client()
    result = db.table("topics").insert({
        "id": topic_id,
        "class_id": class_id,
        "title": title,
        "subject": subject,
        "source_file_url": file_path,
        "status": "processing",
    }).execute()

    generate_standard_graph.delay(topic_id, file_path, title, subject)

    return result.data[0]


@router.get("/")
async def list_topics(user: dict = Depends(get_current_user)):
    db = get_client()
    result = db.table("topics").select("*").order("created_at", desc=True).execute()
    return result.data


@router.get("/{topic_id}/nodes")
async def get_topic_nodes(topic_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    result = db.table("concept_nodes").select("*").eq("topic_id", topic_id).execute()
    return result.data


@router.get("/{topic_id}")
async def get_topic(topic_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    result = db.table("topics").select("id, title, subject, status").eq("id", topic_id).single().execute()
    return result.data


@router.get("/{topic_id}/status")
async def get_topic_status(topic_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    result = db.table("topics").select("status").eq("id", topic_id).single().execute()
    return result.data


@router.delete("/{topic_id}")
async def delete_topic(topic_id: str, teacher: dict = Depends(require_teacher)):
    db = get_client()
    topic = db.table("topics").select("id, neo4j_graph_id, source_file_url").eq("id", topic_id).single().execute().data
    if not topic:
        raise HTTPException(404, "Topic not found")

    # Remove graph from Neo4j (nodes carry topic_id; edges carry graph_id)
    driver = get_driver()
    async with driver.session() as neo_session:
        await neo_session.run(
            "MATCH (c:Concept {topic_id: $topic_id}) DETACH DELETE c",
            topic_id=topic_id,
        )

    # Remove relational rows (concept_nodes first — FK on topic_id)
    db.table("concept_nodes").delete().eq("topic_id", topic_id).execute()
    db.table("topics").delete().eq("id", topic_id).execute()

    # Remove the uploaded PDF
    file_path = topic.get("source_file_url")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    return {"deleted": topic_id}
