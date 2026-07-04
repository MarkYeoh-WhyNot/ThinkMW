from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.auth import get_current_user
from app.db.supabase import get_client

router = APIRouter()


class UserCreate(BaseModel):
    display_name: str
    school_id: str | None = None


@router.post("/")
async def create_user(body: UserCreate, current_user: dict = Depends(get_current_user)):
    """Create the user row for the authenticated account. Identity and role
    come from the verified JWT, never from the request body."""
    db = get_client()
    existing = db.table("users").select("id").eq("id", current_user["id"]).execute()
    if existing.data:
        return existing.data[0]

    result = db.table("users").insert({
        "id": current_user["id"],
        "email": current_user["email"],
        "display_name": body.display_name,
        "role": current_user["role"],
        "school_id": body.school_id,
    }).execute()
    return result.data[0]


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    db = get_client()
    result = db.table("users").select("*").eq("id", current_user["id"]).single().execute()
    return result.data


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["id"] and current_user["role"] != "teacher":
        raise HTTPException(403, "Not authorised to view this user")
    db = get_client()
    result = db.table("users").select("*").eq("id", user_id).single().execute()
    return result.data
