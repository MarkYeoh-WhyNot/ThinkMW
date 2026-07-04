import json
from app.services.ai.llm_client import chat

_SYSTEM = """You are an expert educator extracting structured knowledge graphs from educational content.
Always respond with valid JSON only — no markdown fences, no prose, no extra keys.

CRITICAL: The "type" field on every edge MUST be exactly one of these six strings:
  causes | produces | requires | is_part_of | symbolises | contradicts

Do NOT invent other type names (e.g. "contains", "absorbs", "affects", "enters_through" are all forbidden).
Map every relationship to the closest of the six allowed types."""

_USER_TEMPLATE = """Extract a knowledge graph from this {subject} topic titled "{title}".

Return ONLY valid JSON matching this exact schema — no other keys allowed:
{{
  "nodes": [
    {{"name": "concept name", "description": "one sentence description", "cluster": "sub-topic cluster name"}}
  ],
  "edges": [
    {{
      "source": "concept name",
      "target": "concept name",
      "type": "causes|produces|requires|is_part_of|symbolises|contradicts",
      "valid_types": ["primary_type", "optional_second_type"],
      "label": "human-readable label",
      "guiding_question": "A Socratic question that nudges a student to discover this relationship without revealing the answer. Ask about mechanism, dependency, or consequence — never name the relationship type directly."
    }}
  ]
}}

Type mapping guide (use ONLY these six):
- causes      → A causes/triggers/leads to B  (e.g. sunlight → photosynthesis)
- produces    → A outputs/generates/releases B  (e.g. light reactions → ATP)
- requires    → A needs/depends on/uses B  (e.g. Calvin cycle → CO2)
- is_part_of  → A is a component/sub-process of B  (e.g. thylakoid → chloroplast)
- symbolises  → A represents/stands for B
- contradicts → A opposes/is the inverse of B

The "valid_types" array must contain 1 or 2 types from the six allowed. Use 2 when the relationship genuinely fits two canonical types equally well (e.g. "causes" and "produces"). Always list the best match first. Never invent types outside the six.

The "guiding_question" must be a single Socratic question (one sentence, ending in "?") that prompts a student to think about why source and target are connected. Rules: (1) never mention the relationship type, (2) never name both concepts in the same question — name only one and imply the other, (3) ask about mechanism, consequence, or dependency, not definition.

Additional rules:
- Extract 10–20 key concept nodes
- Node names must be canonical (e.g. "mitochondria" not "the powerhouse")
- Every node must appear in at least one edge
- source and target must exactly match a node name in the nodes array
- Cluster related concepts under a shared cluster name

Content:
{content}"""


def extract_graph_from_text(title: str, subject: str, content: str) -> dict:
    # ~200K chars ≈ 50K tokens — fits comfortably in modern model context windows
    content_chunk = content[:200000]

    raw = chat(
        system=_SYSTEM,
        user=_USER_TEMPLATE.format(subject=subject, title=title, content=content_chunk),
        max_tokens=8192,
        role="extraction",
    )

    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    data = json.loads(raw)
    if not data.get("nodes") or not data.get("edges"):
        raise ValueError("Extraction returned an empty graph")
    return data
