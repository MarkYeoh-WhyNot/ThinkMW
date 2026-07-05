import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

security = HTTPBearer()

_jwks_cache: dict | None = None


def _fetch_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        resp = httpx.get(f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def _decode_with_jwks(token: str) -> dict:
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    jwks = _fetch_jwks()
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        # Signing keys may have rotated — refresh cache once and retry.
        global _jwks_cache
        _jwks_cache = None
        jwks = _fetch_jwks()
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        raise JWTError("No matching JWKS key found")
    return jwt.decode(token, key, algorithms=[key["alg"]], audience="authenticated")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        payload = _decode_with_jwks(token)
    except JWTError:
        try:
            # Legacy projects still signing with the shared HS256 secret.
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {
        "id": payload["sub"],
        "email": payload.get("email"),
        "role": payload.get("user_metadata", {}).get("role", "student"),
    }


async def require_teacher(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    return user
