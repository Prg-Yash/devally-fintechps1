"""
graph.py — LangGraph StateGraph wiring for the Deliverable Verification Agent.

Public API:
    build_graph() -> CompiledGraph
        Builds and compiles the verification graph.
        Call .invoke(state) for a blocking run or .stream(state) for node-by-node updates.

Graph topology:
    detect → fetch → analyse → [should_loop] → fetch  (if confidence < 60 and attempts < 2)
                                              ↓
                                           score → END
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from nodes import analyse_node, detect_node, fetch_node, score_node, should_loop
from state import VerifierState


def build_graph():
    """
    Build and compile the LangGraph verification workflow.

    Returns a compiled graph that supports both:
        graph.invoke(initial_state)         — blocking, returns final state
        graph.stream(initial_state)         — yields {node_name: state_update} per step
    """
    builder = StateGraph(VerifierState)

    # ── Register nodes ────────────────────────────────────────────────────────
    builder.add_node("detect",  detect_node)
    builder.add_node("fetch",   fetch_node)
    builder.add_node("analyse", analyse_node)
    builder.add_node("score",   score_node)

    # ── Entry point ───────────────────────────────────────────────────────────
    builder.set_entry_point("detect")

    # ── Linear edges ─────────────────────────────────────────────────────────
    builder.add_edge("detect",  "fetch")
    builder.add_edge("fetch",   "analyse")

    # ── Conditional loop edge (after analyse) ─────────────────────────────────
    # should_loop returns "fetch_more" or "finalise"
    builder.add_conditional_edges(
        "analyse",
        should_loop,
        {
            "fetch_more": "fetch",   # Loop back for a second fetch+analyse pass
            "finalise":   "score",   # Proceed to final scoring
        },
    )

    # ── Terminal edge ─────────────────────────────────────────────────────────
    builder.add_edge("score", END)

    return builder.compile()
