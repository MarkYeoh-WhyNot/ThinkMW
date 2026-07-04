"""
Smoke test for the extraction pipeline.
Run from the backend/ directory:
    python test_extraction.py
"""
import json
import sys
import os

# Load .env manually so we don't need the full FastAPI app running
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "env.local"))

from app.services.ai.extractor import extract_graph_from_text

SAMPLE_CONTENT = """
Photosynthesis is the process by which plants convert light energy into chemical energy.
Chloroplasts contain chlorophyll, which absorbs sunlight. The light-dependent reactions
occur in the thylakoid membranes, producing ATP and NADPH. The Calvin cycle takes place
in the stroma and uses ATP and NADPH to fix carbon dioxide into glucose. Water is split
during the light reactions, releasing oxygen as a byproduct. Glucose is used by the plant
for growth and respiration. Without sunlight, the light-dependent reactions cannot proceed,
halting the entire process. Carbon dioxide enters through stomata in the leaf. The rate of
photosynthesis is affected by light intensity, CO2 concentration, and temperature.
"""

def main():
    print(f"Provider: {os.getenv('LLM_PROVIDER', 'deepseek')}\n")
    print("Extracting graph from sample Biology content...\n")

    try:
        result = extract_graph_from_text(
            title="Photosynthesis",
            subject="Biology",
            content=SAMPLE_CONTENT,
        )
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)

    nodes = result.get("nodes", [])
    edges = result.get("edges", [])

    print(f"Nodes ({len(nodes)}):")
    for n in nodes:
        print(f"  [{n.get('cluster', '?')}] {n['name']} — {n.get('description', '')}")

    print(f"\nEdges ({len(edges)}):")
    valid_types = {"causes", "produces", "requires", "is_part_of", "symbolises", "contradicts"}
    type_errors = []
    for e in edges:
        marker = "✓" if e.get("type") in valid_types else "✗"
        print(f"  {marker} {e['source']} --[{e['type']}]--> {e['target']}  (\"{e.get('label', '')}\")")
        if e.get("type") not in valid_types:
            type_errors.append(e)

    print("\n--- Validation ---")
    node_names = {n["name"] for n in nodes}
    orphans = [n for n in nodes if not any(e["source"] == n["name"] or e["target"] == n["name"] for e in edges)]

    print(f"Total nodes: {len(nodes)}")
    print(f"Total edges: {len(edges)}")
    print(f"Orphan nodes (not in any edge): {len(orphans)}" + (f" {[o['name'] for o in orphans]}" if orphans else ""))
    print(f"Invalid edge types: {len(type_errors)}" + (f" {[e['type'] for e in type_errors]}" if type_errors else ""))

    missing_nodes = [e["source"] for e in edges if e["source"] not in node_names] + \
                    [e["target"] for e in edges if e["target"] not in node_names]
    print(f"Edges referencing unknown nodes: {len(missing_nodes)}" + (f" {missing_nodes}" if missing_nodes else ""))

    if not type_errors and not orphans and not missing_nodes:
        print("\nPASS — graph is valid")
    else:
        print("\nWARN — graph has issues (see above)")


if __name__ == "__main__":
    main()
