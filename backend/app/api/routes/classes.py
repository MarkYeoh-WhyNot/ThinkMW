import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.auth import get_current_user, require_teacher
from app.db.supabase import get_client

router = APIRouter()


class ClassCreate(BaseModel):
    school_id: str | None = None
    name: str
    subject: str


@router.post("/")
async def create_class(body: ClassCreate, teacher: dict = Depends(require_teacher)):
    db = get_client()
    result = db.table("classes").insert({
        "id": str(uuid.uuid4()),
        "teacher_id": teacher["id"],
        **body.model_dump(),
    }).execute()
    return result.data[0]


@router.get("/{class_id}")
async def get_class(class_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    result = db.table("classes").select("*, topics(*)").eq("id", class_id).single().execute()
    return result.data


@router.post("/{class_id}/join")
async def join_class(class_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    db.table("class_enrolments").insert({"class_id": class_id, "student_id": user["id"]}).execute()
    return {"joined": True}


@router.get("/join/{invite_code}")
async def join_by_code(invite_code: str, user: dict = Depends(get_current_user)):
    db = get_client()
    cls = db.table("classes").select("id").eq("invite_code", invite_code).single().execute()
    db.table("class_enrolments").insert(
        {"class_id": cls.data["id"], "student_id": user["id"]}
    ).execute()
    return {"class_id": cls.data["id"]}
