from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import topics, graphs, sessions, classes, users, library

app = FastAPI(title="ThinkMW API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router,   prefix="/api/users",   tags=["users"])
app.include_router(classes.router, prefix="/api/classes", tags=["classes"])
app.include_router(topics.router,  prefix="/api/topics",  tags=["topics"])
app.include_router(graphs.router,  prefix="/api/graphs",  tags=["graphs"])
app.include_router(sessions.router,prefix="/api/sessions",tags=["sessions"])
app.include_router(library.router, prefix="/api/library",  tags=["library"])


@app.get("/health")
def health():
    return {"status": "ok"}
