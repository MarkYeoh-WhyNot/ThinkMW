"use client"

import { useEffect } from "react"
import { useCanvasStore } from "@/lib/stores/canvas.store"
import { type Node } from "reactflow"

export interface TrayNode {
  id: string
  canonical_name: string
  description: string
  cluster_tag: string | null
}

interface ClusterGuideProps {
  allNodes: TrayNode[]
  onFitView: (opts?: { padding?: number; duration?: number }) => void
}

function constraintLabel(n: number): string {
  const max = n + 2
  return `Connect these ${n} concept${n !== 1 ? "s" : ""} — aim for no more than ${max} relationships.`
}

export function buildClusterNodes(clusterNodes: TrayNode[]): Node[] {
  const COLS = Math.max(2, Math.ceil(Math.sqrt(clusterNodes.length)))
  const COL_GAP = 240
  const ROW_GAP = 180
  return clusterNodes.map((n, i) => ({
    id: n.id,
    type: "concept" as const,
    position: {
      x: 160 + (i % COLS) * COL_GAP,
      y: 100 + Math.floor(i / COLS) * ROW_GAP,
    },
    data: {
      label: n.canonical_name,
      description: n.description,
      cluster: n.cluster_tag ?? "default",
    },
  }))
}

// Called when guided mode needs to auto-place a cluster's nodes
function placeCluster(
  allNodes: TrayNode[],
  clusterName: string,
  onFitView: (opts?: any) => void
) {
  const state = useCanvasStore.getState()
  const clusterNodes = allNodes.filter((n) => (n.cluster_tag ?? "General") === clusterName)
  const placed = new Set(state.nodes.map((n) => n.id))
  const toPlace = clusterNodes.filter((n) => !placed.has(n.id))
  if (toPlace.length === 0) {
    setTimeout(() => onFitView({ padding: 0.35, duration: 400 }), 60)
    return
  }
  const newNodes = buildClusterNodes(toPlace)
  state.setNodes([...state.nodes, ...newNodes])
  setTimeout(() => onFitView({ padding: 0.35, duration: 400 }), 80)
}

export default function ClusterGuide({ allNodes, onFitView }: ClusterGuideProps) {
  const { guided, advanceCluster, exitGuidedMode } = useCanvasStore()
  const { active, phase, clusterQueue, currentClusterIndex, completedClusters } = guided

  // Auto-place nodes whenever the current cluster changes
  useEffect(() => {
    if (!active || phase !== "cluster") return
    const currentCluster = clusterQueue[currentClusterIndex]
    if (!currentCluster) return
    placeCluster(allNodes, currentCluster, onFitView)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, phase, currentClusterIndex])

  if (!active) return null

  if (phase === "intercluster") {
    // Place any remaining unplaced nodes on first render of intercluster phase
    return (
      <div className="w-full bg-purple-50 border-b border-purple-200 px-5 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-purple-800">
            Zoom out — now connect the groups
          </p>
          <p className="text-xs text-purple-500 mt-0.5">
            You've mapped each group individually. Now draw relationships between concepts across different groups.
          </p>
        </div>
        <button
          onClick={() => {
            exitGuidedMode()
            setTimeout(() => onFitView({ padding: 0.1, duration: 600 }), 50)
          }}
          className="flex-shrink-0 text-xs px-3 py-1.5 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
        >
          Done ✓
        </button>
      </div>
    )
  }

  if (phase !== "cluster") return null

  const currentCluster = clusterQueue[currentClusterIndex]
  const clusterNodes = allNodes.filter((n) => (n.cluster_tag ?? "General") === currentCluster)
  const totalClusters = clusterQueue.length
  const progress = completedClusters.length / totalClusters
  const isLast = currentClusterIndex + 1 >= totalClusters

  function handleAdvance() {
    advanceCluster()
    // After state update, place next cluster or fit all for intercluster
    setTimeout(() => {
      const state = useCanvasStore.getState()
      const g = state.guided

      if (g.phase === "intercluster") {
        // Place all remaining nodes
        const placed = new Set(state.nodes.map((n) => n.id))
        const remaining = allNodes.filter((n) => !placed.has(n.id))
        if (remaining.length > 0) {
          const newNodes = buildClusterNodes(remaining)
          state.setNodes([...state.nodes, ...newNodes])
        }
        setTimeout(() => onFitView({ padding: 0.08, duration: 700 }), 80)
      } else {
        const nextCluster = g.clusterQueue[g.currentClusterIndex]
        placeCluster(allNodes, nextCluster, onFitView)
      }
    }, 60)
  }

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between gap-4 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <p className="text-sm font-semibold text-amber-900 truncate">
            Group: <span className="text-amber-700">{currentCluster}</span>
          </p>
          <span className="text-xs text-amber-400 flex-shrink-0">
            {currentClusterIndex + 1} / {totalClusters}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden w-32">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progress * 100, 5)}%` }}
            />
          </div>
          <p className="text-xs text-amber-600">
            {constraintLabel(clusterNodes.length)}
          </p>
        </div>
      </div>
      <button
        onClick={handleAdvance}
        className="flex-shrink-0 text-xs px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
      >
        {isLast ? "Zoom out →" : "Next group →"}
      </button>
    </div>
  )
}
