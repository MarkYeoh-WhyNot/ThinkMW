"""Unit tests for the scoring engine — run with: pytest tests/test_scorer.py"""
import pytest
from app.services.scoring.scorer import compute_score, get_missed_edges, _structural_score, build_nx_graph


def edge(src, tgt, type_="causes", valid_types=None, **kw):
    return {
        "source_node_id": src,
        "target_node_id": tgt,
        "type": type_,
        "valid_types": valid_types or [type_],
        "canonical_type": kw.get("canonical_type", type_),
        **kw,
    }


STANDARD = [
    edge("a", "b", "causes"),
    edge("b", "c", "produces"),
    edge("c", "d", "requires", valid_types=["requires", "causes"]),
]


class TestComputeScore:
    def test_perfect_coverage(self):
        student = [
            edge("a", "b", canonical_type="causes"),
            edge("b", "c", canonical_type="produces"),
            edge("c", "d", canonical_type="requires"),
        ]
        s = compute_score(STANDARD, student, 0, 0, total_nodes=4, placed_nodes=4)
        assert s.coverage == 1.0
        assert s.completeness == 1.0

    def test_zero_coverage_empty_student(self):
        s = compute_score(STANDARD, [], 0, 0, total_nodes=4, placed_nodes=0)
        assert s.coverage == 0.0
        assert s.completeness == 0.0
        assert s.total == 0.0

    def test_wrong_type_does_not_count(self):
        student = [edge("a", "b", canonical_type="contradicts")]
        s = compute_score(STANDARD, student, 0, 0, total_nodes=4, placed_nodes=2)
        assert s.coverage == 0.0

    def test_second_valid_type_counts(self):
        # standard c→d accepts requires OR causes
        student = [edge("c", "d", canonical_type="causes")]
        s = compute_score(STANDARD, student, 0, 0, total_nodes=4, placed_nodes=2)
        assert s.coverage == pytest.approx(1 / 3, abs=0.01)

    def test_novel_ratio(self):
        s = compute_score(STANDARD, [], novel_valid_count=2, novel_total_count=4,
                          total_nodes=4, placed_nodes=0)
        assert s.novel_valid == 0.5

    def test_no_standard_edges(self):
        s = compute_score([], [], 0, 0, total_nodes=0, placed_nodes=0)
        assert s.total == 0.0

    def test_total_bounded_zero_one(self):
        student = [
            edge("a", "b", canonical_type="causes"),
            edge("b", "c", canonical_type="produces"),
            edge("c", "d", canonical_type="requires"),
        ]
        s = compute_score(STANDARD, student, 5, 5, total_nodes=4, placed_nodes=4)
        assert 0.0 <= s.total <= 1.0


class TestStructuralScore:
    def test_single_node_zero(self):
        G = build_nx_graph([])
        assert _structural_score(G) == 0.0

    def test_connected_beats_fragmented(self):
        connected = build_nx_graph([edge("a", "b"), edge("b", "c"), edge("c", "d")])
        fragmented = build_nx_graph([edge("a", "b"), edge("c", "d")])
        assert _structural_score(connected) > _structural_score(fragmented)


class TestMissedEdges:
    def test_all_missed_when_empty(self):
        assert len(get_missed_edges(STANDARD, [])) == 3

    def test_correct_edge_not_missed(self):
        student = [edge("a", "b", canonical_type="causes")]
        missed = get_missed_edges(STANDARD, student)
        assert len(missed) == 2
        assert ("a", "b") not in {(e["source_node_id"], e["target_node_id"]) for e in missed}

    def test_wrong_type_still_missed(self):
        student = [edge("a", "b", canonical_type="is_part_of")]
        assert len(get_missed_edges(STANDARD, student)) == 3
