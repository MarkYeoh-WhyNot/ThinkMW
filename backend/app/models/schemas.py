from uuid import UUID
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class UserRole(str, Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class EdgeRelationType(str, Enum):
    causes = "causes"
    produces = "produces"
    requires = "requires"
    is_part_of = "is_part_of"
    symbolises = "symbolises"
    contradicts = "contradicts"


class LLMVerdict(str, Enum):
    valid = "valid"
    weak = "weak"
    invalid = "invalid"


class SimilarityRoute(str, Enum):
    auto_map = "auto_map"       # >= 0.88
    confirm = "confirm"          # 0.65–0.88
    llm_judge = "llm_judge"      # 0.40–0.65
    novel = "novel"              # < 0.40


# ── Request / Response schemas ──────────────────────────────────────────────

class ConceptNodeOut(BaseModel):
    id: UUID
    canonical_name: str
    aliases: list[str]
    description: str | None
    cluster_tag: str | None


class EdgeIn(BaseModel):
    source_node_id: UUID
    target_node_id: UUID
    label: str                  # free-text from student
    justification: str | None = None


class EdgeOut(BaseModel):
    model_config = {"extra": "ignore"}

    source_node_id: str
    target_node_id: str
    label: str = ""
    source_name: str | None = None
    target_name: str | None = None
    type: str | None = None
    canonical_type: str | None = None
    similarity_score: float | None = None
    is_novel: bool = False
    llm_verdict: str | None = None


class GraphSessionIn(BaseModel):
    topic_id: UUID
    student_id: UUID | None = None


class GraphSessionOut(BaseModel):
    id: UUID
    topic_id: UUID
    student_id: UUID | None = None
    started_at: datetime
    submitted_at: datetime | None
    hints_used: int
    time_spent_secs: int | None


class StudentGraphSubmission(BaseModel):
    edges: list[EdgeIn]


class ScoreBreakdown(BaseModel):
    coverage: float
    novel_valid: float
    structure: float
    completeness: float
    total: float


class GraphComparisonOut(BaseModel):
    session_id: UUID
    score: ScoreBreakdown
    missed_edges: list[EdgeOut]
    novel_edges: list[EdgeOut]
    correct_edges: list[EdgeOut]
    merge_eligible: bool
    attempt_number: int = 1


class TopicCreate(BaseModel):
    class_id: UUID | None = None
    title: str


class TopicOut(BaseModel):
    id: UUID
    class_id: UUID | None = None
    title: str
    subject: str
    status: str
    source_file_url: str | None
    created_at: datetime
