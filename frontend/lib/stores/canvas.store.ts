/**
 * Zustand store for the student graph canvas.
 * Owns all node/edge state, behavioural signals, and guided cold-start mode.
 */
import { create } from "zustand"
import { type Node, type Edge, addEdge, applyNodeChanges, applyEdgeChanges } from "reactflow"

interface PendingEdge {
  edgeId: string | null
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string | null
  targetHandle: string | null
  label: string
  justification: string
}

export interface BehaviourSignals {
  deleteCount: number
  lastActionAt: number
  stuckSubmissions: number
  nudge: string | null
}

export type GuidedPhase = "cluster" | "intercluster" | "free"

interface GuidedState {
  active: boolean
  phase: GuidedPhase
  clusterQueue: string[]
  currentClusterIndex: number
  completedClusters: string[]
}

const DEFAULT_BEHAVIOUR: BehaviourSignals = {
  deleteCount: 0,
  lastActionAt: Date.now(),
  stuckSubmissions: 0,
  nudge: null,
}

const DEFAULT_GUIDED: GuidedState = {
  active: false,
  phase: "free",
  clusterQueue: [],
  currentClusterIndex: 0,
  completedClusters: [],
}

interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  pendingEdge: PendingEdge | null
  hintsUsed: number
  sessionId: string | null
  isSubmitting: boolean
  behaviour: BehaviourSignals
  primedNodeIds: string[]
  guided: GuidedState

  setSessionId: (id: string) => void
  setNodes: (nodes: Node[]) => void
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (connection: any) => void
  setPendingEdge: (edge: PendingEdge | null) => void
  startEditEdge: (edge: Edge) => void
  confirmEdgeLabel: (label: string, justification?: string) => void
  incrementHint: () => void
  setSubmitting: (v: boolean) => void
  recordSubmitDelta: (deltaPts: number) => void
  dismissNudge: () => void
  setPrimedNodes: (ids: string[]) => void
  startGuidedMode: (clusters: string[]) => void
  advanceCluster: () => void
  exitGuidedMode: () => void
  reset: () => void
}

function pickNudge(signals: BehaviourSignals, edgeCount: number): string | null {
  if (signals.deleteCount >= 3) {
    return "You've removed several connections — which concept feels most central to this topic? Start from there."
  }
  if (edgeCount >= 12) {
    return "Your graph is getting complex. Try focusing on one cluster at a time before adding more connections."
  }
  if (signals.stuckSubmissions >= 2) {
    return "Your score hasn't changed much across attempts. Try re-reading the source material, then rebuild one section."
  }
  return null
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  pendingEdge: null,
  hintsUsed: 0,
  sessionId: null,
  isSubmitting: false,
  behaviour: DEFAULT_BEHAVIOUR,
  primedNodeIds: [],
  guided: DEFAULT_GUIDED,

  setSessionId: (id) => set({ sessionId: id }),

  setNodes: (nodes) => set({ nodes }),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) => {
    const removals = changes.filter((c: any) => c.type === "remove")
    set((s) => {
      const nextEdges = applyEdgeChanges(changes, s.edges)
      const deleteCount = s.behaviour.deleteCount + removals.length
      const nudge = pickNudge({ ...s.behaviour, deleteCount }, nextEdges.length)
      return {
        edges: nextEdges,
        behaviour: {
          ...s.behaviour,
          deleteCount,
          lastActionAt: Date.now(),
          nudge,
        },
      }
    })
  },

  onConnect: (connection) => {
    set((s) => ({
      pendingEdge: {
        edgeId: null,
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
        label: "",
        justification: "",
      },
      behaviour: { ...s.behaviour, lastActionAt: Date.now() },
    }))
  },

  setPendingEdge: (edge) => set({ pendingEdge: edge }),

  startEditEdge: (edge) => {
    set({
      pendingEdge: {
        edgeId: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        label: (edge.data?.label as string | undefined) ?? (edge.label as string | undefined) ?? "",
        justification: (edge.data?.justification as string | undefined) ?? "",
      },
    })
  },

  confirmEdgeLabel: (label, justification) => {
    const { pendingEdge } = get()
    if (!pendingEdge) return

    if (pendingEdge.edgeId) {
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id === pendingEdge.edgeId
            ? { ...e, label, data: { ...e.data, label, justification: justification ?? null } }
            : e
        ),
        pendingEdge: null,
        behaviour: { ...s.behaviour, lastActionAt: Date.now() },
      }))
      return
    }

    const newEdge: Edge = {
      id: `${pendingEdge.sourceNodeId}-${pendingEdge.targetNodeId}-${Date.now()}`,
      source: pendingEdge.sourceNodeId,
      target: pendingEdge.targetNodeId,
      sourceHandle: pendingEdge.sourceHandle,
      targetHandle: pendingEdge.targetHandle,
      label,
      type: "default",
      data: { label, justification: justification ?? null, canonicalType: null, route: null },
    }

    set((s) => {
      const nextEdges = addEdge(newEdge, s.edges)
      const nudge = pickNudge(s.behaviour, nextEdges.length)
      return {
        edges: nextEdges,
        pendingEdge: null,
        behaviour: { ...s.behaviour, lastActionAt: Date.now(), nudge },
      }
    })
  },

  recordSubmitDelta: (deltaPts) => {
    set((s) => {
      const stuckSubmissions = Math.abs(deltaPts) < 5
        ? s.behaviour.stuckSubmissions + 1
        : 0
      const nudge = pickNudge({ ...s.behaviour, stuckSubmissions }, s.edges.length)
      return {
        behaviour: { ...s.behaviour, stuckSubmissions, nudge },
      }
    })
  },

  dismissNudge: () =>
    set((s) => ({ behaviour: { ...s.behaviour, nudge: null } })),

  incrementHint: () => set((s) => ({ hintsUsed: s.hintsUsed + 1 })),

  setSubmitting: (v) => set({ isSubmitting: v }),

  setPrimedNodes: (ids) => set({ primedNodeIds: ids }),

  startGuidedMode: (clusters) =>
    set({
      guided: {
        active: true,
        phase: "cluster",
        clusterQueue: clusters,
        currentClusterIndex: 0,
        completedClusters: [],
      },
    }),

  advanceCluster: () =>
    set((s) => {
      const { guided } = s
      const nextIndex = guided.currentClusterIndex + 1
      const completedClusters = [
        ...guided.completedClusters,
        guided.clusterQueue[guided.currentClusterIndex],
      ]

      if (nextIndex >= guided.clusterQueue.length) {
        return {
          guided: {
            ...guided,
            phase: "intercluster",
            currentClusterIndex: nextIndex,
            completedClusters,
          },
        }
      }

      return {
        guided: {
          ...guided,
          currentClusterIndex: nextIndex,
          completedClusters,
        },
      }
    }),

  exitGuidedMode: () =>
    set((s) => ({
      guided: { ...s.guided, active: false, phase: "free" },
    })),

  reset: () => set({
    nodes: [],
    edges: [],
    pendingEdge: null,
    hintsUsed: 0,
    isSubmitting: false,
    behaviour: DEFAULT_BEHAVIOUR,
    primedNodeIds: [],
    guided: DEFAULT_GUIDED,
  }),
}))
