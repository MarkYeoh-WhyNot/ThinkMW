"use client"

import { useState } from "react"
import { useCanvasStore } from "@/lib/stores/canvas.store"
import { type Node } from "reactflow"
import { clsx } from "clsx"

interface TrayNode {
  id: string
  canonical_name: string
  description: string
  cluster_tag: string | null
}

interface NodeTrayProps {
  nodes: TrayNode[]
}

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className="absolute left-full top-0 ml-2 z-50 w-52 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl pointer-events-none leading-relaxed">
      {text}
      <div className="absolute right-full top-3 border-4 border-transparent border-r-gray-900" />
    </div>
  )
}

function groupByCluster(nodes: TrayNode[]): Record<string, TrayNode[]> {
  return nodes.reduce<Record<string, TrayNode[]>>((acc, n) => {
    const key = n.cluster_tag ?? "General"
    if (!acc[key]) acc[key] = []
    acc[key].push(n)
    return acc
  }, {})
}

export default function NodeTray({ nodes }: NodeTrayProps) {
  const [search, setSearch] = useState("")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const { nodes: canvasNodes, setNodes, guided, primedNodeIds } = useCanvasStore()

  const placedIds = new Set(canvasNodes.map((n) => n.id))

  // In guided cluster mode, restrict visible nodes to current cluster
  const visibleNodes = (() => {
    if (guided.active && guided.phase === "cluster") {
      const currentCluster = guided.clusterQueue[guided.currentClusterIndex]
      return nodes.filter((n) => (n.cluster_tag ?? "General") === currentCluster)
    }
    return nodes
  })()

  const filtered = visibleNodes.filter((n) =>
    n.canonical_name.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = groupByCluster(filtered)
  const clusters = Object.keys(grouped).sort()

  const addToCanvas = (trayNode: TrayNode) => {
    if (placedIds.has(trayNode.id)) return
    const newNode: Node = {
      id: trayNode.id,
      type: "concept",
      position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {
        label: trayNode.canonical_name,
        description: trayNode.description,
        cluster: trayNode.cluster_tag ?? "default",
      },
    }
    setNodes([...canvasNodes, newNode])
  }

  const currentClusterLabel = guided.active && guided.phase === "cluster"
    ? guided.clusterQueue[guided.currentClusterIndex]
    : null

  return (
    <aside className="w-48 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
          {currentClusterLabel ? (
            <span className="text-amber-500">{currentClusterLabel}</span>
          ) : (
            "Concept Nodes"
          )}
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
        {clusters.map((cluster) => (
          <div key={cluster}>
            {/* Only show cluster header when not in single-cluster guided mode */}
            {!currentClusterLabel && (
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 px-1 mb-1">
                {cluster}
              </p>
            )}
            <div className="flex flex-col gap-1">
              {grouped[cluster].map((node) => {
                const placed = placedIds.has(node.id)
                const hovered = hoveredId === node.id
                const primed = primedNodeIds.includes(node.id)
                return (
                  <div key={node.id} className="relative">
                    <button
                      onClick={() => addToCanvas(node)}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      disabled={placed}
                      className={clsx(
                        "w-full text-left text-xs font-medium px-2.5 py-2 rounded-md border transition-colors flex items-center justify-between gap-1",
                        placed
                          ? "opacity-30 line-through border-gray-200 cursor-not-allowed"
                          : primed
                          ? "border-blue-300 bg-blue-50 hover:border-blue-500 cursor-pointer"
                          : "border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                      )}
                    >
                      <span>{node.canonical_name}</span>
                      <span className="flex-shrink-0 flex items-center gap-0.5">
                        {primed && !placed && (
                          <span className="text-blue-400 text-[10px]" title="You mentioned this">✦</span>
                        )}
                        {node.description && !placed && (
                          <span className="text-gray-300 text-[10px]">ⓘ</span>
                        )}
                      </span>
                    </button>
                    {hovered && node.description && (
                      <Tooltip text={node.description} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {guided.active && guided.phase === "intercluster" && (
          <div className="mt-2 px-2 py-3 border border-purple-100 rounded-lg bg-purple-50">
            <p className="text-[10px] text-purple-500 font-semibold uppercase tracking-widest mb-1">
              Zoom-out mode
            </p>
            <p className="text-[11px] text-purple-700 leading-relaxed">
              All concepts are on the canvas. Draw connections between different groups.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
