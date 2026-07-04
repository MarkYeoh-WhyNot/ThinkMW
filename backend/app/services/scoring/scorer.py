"""Graph comparison and scoring engine."""
import networkx as nx
from app.core.config import settings
from app.models.schemas import ScoreBreakdown


def build_nx_graph(edges: list[dict]) -> nx.DiGraph:
    G = nx.DiGraph()
    for e in edges:
        G.add_edge(e["source_node_id"], e["target_node_id"], **e)
    return G


def compute_score(
    standard_edges: list[dict],
    student_edges: list[dict],
    novel_valid_count: int,
    novel_total_count: int,
    total_nodes: int,
    placed_nodes: int,
) -> ScoreBreakdown:
    # Build lookup: (src, tgt) → set of valid canonical types for that standard edge
    std_valid_types: dict[tuple, set[str]] = {
        (e["source_node_id"], e["target_node_id"]): set(e.get("valid_types") or [e["type"]])
        for e in standard_edges
    }
    std_pairs = set(std_valid_types.keys())
    stu_pairs = {(e["source_node_id"], e["target_node_id"]) for e in student_edges}

    # Build lookup: student canonical type per pair
    stu_type: dict[tuple, str | None] = {
        (e["source_node_id"], e["target_node_id"]): e.get("canonical_type")
        for e in student_edges
    }

    # 1. Coverage — pair matched AND student type is in valid_types for that edge
    correct = {
        pair for pair in (std_pairs & stu_pairs)
        if stu_type.get(pair) in std_valid_types[pair]
    }
    coverage = len(correct) / len(std_pairs) if std_pairs else 0.0

    # 2. Novel valid — rewarded as fraction of total novel attempts
    novel_valid = (novel_valid_count / novel_total_count) if novel_total_count else 0.0

    # 3. Structural quality via NetworkX
    G_student = build_nx_graph(student_edges)
    structure = _structural_score(G_student)

    # 4. Node completeness
    completeness = placed_nodes / total_nodes if total_nodes else 0.0

    total = (
        settings.SCORE_WEIGHT_COVERAGE     * coverage
        + settings.SCORE_WEIGHT_NOVEL      * novel_valid
        + settings.SCORE_WEIGHT_STRUCTURE  * structure
        + settings.SCORE_WEIGHT_COMPLETENESS * completeness
    )

    return ScoreBreakdown(
        coverage=round(coverage, 3),
        novel_valid=round(novel_valid, 3),
        structure=round(structure, 3),
        completeness=round(completeness, 3),
        total=round(total, 3),
    )


def _structural_score(G: nx.DiGraph) -> float:
    """Score graph structure quality on 0–1 scale."""
    if G.number_of_nodes() < 2:
        return 0.0

    scores = []

    # Connected components — penalise fragmented graphs
    undirected = G.to_undirected()
    n_components = nx.number_connected_components(undirected)
    connectivity = 1.0 / n_components
    scores.append(connectivity)

    # Average clustering coefficient — reward concept grouping
    clustering = nx.average_clustering(undirected)
    scores.append(clustering)

    # Betweenness centrality — reward having key bridging nodes
    if G.number_of_nodes() >= 3:
        centrality = nx.betweenness_centrality(G)
        max_centrality = max(centrality.values()) if centrality else 0
        scores.append(min(max_centrality * 2, 1.0))  # scale up

    return sum(scores) / len(scores)


def get_missed_edges(standard_edges: list[dict], student_edges: list[dict]) -> list[dict]:
    stu_type: dict[tuple, str | None] = {
        (e["source_node_id"], e["target_node_id"]): e.get("canonical_type")
        for e in student_edges
    }
    result = []
    for e in standard_edges:
        pair = (e["source_node_id"], e["target_node_id"])
        valid = set(e.get("valid_types") or [e["type"]])
        if pair not in stu_type or stu_type[pair] not in valid:
            result.append(e)
    return result


def check_merge_eligibility(
    standard_edges: list[dict],
    student_a_edges: list[dict],
    student_b_edges: list[dict],
) -> bool:
    """Both students must outperform standard on at least one shared cluster."""
    std_pairs = {(e["source_node_id"], e["target_node_id"]) for e in standard_edges}

    a_novel = {(e["source_node_id"], e["target_node_id"]) for e in student_a_edges
               if e.get("is_novel") and e.get("llm_verdict") == "valid"}
    b_novel = {(e["source_node_id"], e["target_node_id"]) for e in student_b_edges
               if e.get("is_novel") and e.get("llm_verdict") == "valid"}

    return bool(a_novel) and bool(b_novel)
