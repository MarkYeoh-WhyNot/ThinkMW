from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return {
            "id": payload["sub"],
            "email": payload.get("email"),
            "role": payload.get("user_metadata", {}).get("role", "student"),
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def require_teacher(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    return user
