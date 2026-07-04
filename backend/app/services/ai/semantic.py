"""Semantic similarity layer for edge label normalisation."""
import json
import numpy as np
from openai import OpenAI
from app.core.config import settings
from app.models.schemas import EdgeRelationType, SimilarityRoute, LLMVerdict
from app.services.ai.llm_client import chat

_openai = OpenAI(api_key=settings.OPENAI_API_KEY)

CANONICAL_DESCRIPTIONS = {
    EdgeRelationType.causes:     "causes, leads to, results in, triggers, makes happen",
    EdgeRelationType.produces:   "produces, generates, outputs, releases, creates, makes",
    EdgeRelationType.requires:   "requires, needs, depends on, uses, consumes",
    EdgeRelationType.is_part_of: "is part of, belongs to, is a component of, is contained in",
    EdgeRelationType.symbolises: "symbolises, represents, stands for, is a metaphor for",
    EdgeRelationType.contradicts:"contradicts, opposes, conflicts with, is the opposite of",
}

# Cached canonical embeddings — computed once at startup
_canonical_embeddings: dict[str, list[float]] | None = None

# Cache of label-text → embedding. Students reuse labels ("causes", "needs",
# "leads to") constantly, so this avoids most embedding round-trips.
_label_embedding_cache: dict[str, list[float]] = {}
_LABEL_CACHE_MAX = 2048


def _embed(text: str) -> list[float]:
    key = text.strip().lower()
    cached = _label_embedding_cache.get(key)
    if cached is not None:
        return cached

    response = _openai.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    embedding = response.data[0].embedding

    if len(_label_embedding_cache) >= _LABEL_CACHE_MAX:
        _label_embedding_cache.pop(next(iter(_label_embedding_cache)))
    _label_embedding_cache[key] = embedding
    return embedding


def _parse_llm_json(raw: str) -> dict | None:
    """Parse JSON from an LLM response, tolerating markdown fences. None on failure."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None


def _cosine(a: list[float], b: list[float]) -> float:
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def get_canonical_embeddings() -> dict[str, list[float]]:
    global _canonical_embeddings
    if _canonical_embeddings is None:
        _canonical_embeddings = {
            rel.value: _embed(desc)
            for rel, desc in CANONICAL_DESCRIPTIONS.items()
        }
    return _canonical_embeddings


def map_label(
    label: str,
    source_concept: str,
    target_concept: str,
    subject: str,
) -> dict:
    """
    Map a free-text edge label to a canonical relationship type.
    Returns: {canonical_type, similarity_score, route, requires_confirm}
    """
    label_embedding = _embed(label)
    canonical_embeddings = get_canonical_embeddings()

    scores = {
        rel_type: _cosine(label_embedding, emb)
        for rel_type, emb in canonical_embeddings.items()
    }
    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]

    if best_score >= settings.SIMILARITY_AUTO_MAP:
        return {
            "canonical_type": best_type,
            "similarity_score": best_score,
            "route": SimilarityRoute.auto_map,
            "requires_confirm": False,
        }

    if best_score >= settings.SIMILARITY_CONFIRM:
        return {
            "canonical_type": best_type,
            "similarity_score": best_score,
            "route": SimilarityRoute.confirm,
            "requires_confirm": True,
        }

    if best_score >= settings.SIMILARITY_LLM_JUDGE:
        verdict = _llm_judge(label, source_concept, target_concept, subject, best_type)
        return {
            "canonical_type": verdict["type"],
            "similarity_score": best_score,
            "route": SimilarityRoute.llm_judge,
            "requires_confirm": not verdict["confident"],
        }

    return {
        "canonical_type": None,
        "similarity_score": best_score,
        "route": SimilarityRoute.novel,
        "requires_confirm": False,
    }


def _llm_judge(
    label: str,
    source: str,
    target: str,
    subject: str,
    best_guess: str,
) -> dict:
    prompt = f"""You are assessing an edge label in a {subject} knowledge graph.

Source concept: {source}
Target concept: {target}
Student label: "{label}"
Best canonical type guess: {best_guess}

Does "{label}" most accurately represent one of these relationship types?
- causes: causes, leads to, results in
- produces: produces, generates, outputs
- requires: requires, needs, depends on
- is_part_of: is part of, belongs to
- symbolises: symbolises, represents
- contradicts: contradicts, opposes

Return JSON only:
{{"type": "<relationship_type>", "confident": true/false, "explanation": "one sentence"}}"""

    raw = chat(system="You are a knowledge graph classifier. Return JSON only.", user=prompt, max_tokens=256, role="judge")
    result = _parse_llm_json(raw)
    if result is None or result.get("type") not in {r.value for r in EdgeRelationType}:
        # LLM output unusable — fall back to the embedding's best guess, ask student to confirm
        return {"type": best_guess, "confident": False, "explanation": "automatic fallback"}
    return result


def judge_novel_edge(
    label: str,
    source: str,
    target: str,
    subject: str,
) -> LLMVerdict:
    """Assess whether a novel edge (not in standard graph) is valid, weak, or invalid."""
    prompt = f"""You are an expert {subject} educator assessing a student's knowledge graph.

The student drew an edge NOT in the standard graph:
  {source} --[{label}]--> {target}

Is this connection:
- valid: scientifically/academically correct and meaningful
- weak: plausible but imprecise or too vague to be useful
- invalid: factually wrong or logically incorrect

Return JSON only: {{"verdict": "valid|weak|invalid", "explanation": "one sentence"}}"""

    raw = chat(system="You are an expert educator assessing student knowledge graphs. Return JSON only.", user=prompt, max_tokens=256, role="judge")
    result = _parse_llm_json(raw)
    try:
        return LLMVerdict(result["verdict"])
    except (TypeError, KeyError, ValueError):
        # Unusable LLM output — grade leniently as "weak" rather than failing the submit
        return LLMVerdict.weak
