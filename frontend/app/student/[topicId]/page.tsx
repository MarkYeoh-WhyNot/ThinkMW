"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import api from "@/lib/api/client"
import { useCanvasStore } from "@/lib/stores/canvas.store"
import GraphCanvas from "@/components/canvas/GraphCanvas"
import NodeTray from "@/components/canvas/NodeTray"
import ScorePanel, { type ScoreResult } from "@/components/canvas/ScorePanel"
import type { TrayNode } from "@/components/canvas/ClusterGuide"

function orderClustersBySize(nodes: TrayNode[]): string[] {
  const counts: Record<string, number> = {}
  for (const n of nodes) {
    const k = n.cluster_tag ?? "General"
    counts[k] = (counts[k] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
}

function CanvasPageInner() {
  const { topicId } = useParams<{ topicId: string }>()
  const searchParams = useSearchParams()

  const [trayNodes, setTrayNodes] = useState<TrayNode[]>([])
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState<ScoreResult | null>(null)
  const [prevScore, setPrevScore] = useState<ScoreResult | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const {
    edges,
    guided,
    reset,
    setSessionId: storeSetSession,
    recordSubmitDelta,
    setPrimedNodes,
    startGuidedMode,
  } = useCanvasStore()

  useEffect(() => {
    reset()

    const primedParam = searchParams.get("primed")
    const guidedParam = searchParams.get("guided")
    const clustersParam = searchParams.get("clusters")

    Promise.all([
      api.get<TrayNode[]>(`/api/topics/${topicId}/nodes`),
      api.post<{ id: string }>("/api/sessions/", { topic_id: topicId }),
    ]).then(([nodesRes, sessionRes]) => {
      setTrayNodes(nodesRes.data)
      setSessionId(sessionRes.data.id)
      storeSetSession(sessionRes.data.id)

      if (guidedParam === "1") {
        if (primedParam) {
          setPrimedNodes(primedParam.split(",").filter(Boolean))
        }
        const clusters = clustersParam
          ? clustersParam.split(",").filter(Boolean)
          : orderClustersBySize(nodesRes.data)
        startGuidedMode(clusters)
      }
    }).catch(console.error)
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId])

  async function handleSubmit() {
    if (!sessionId || edges.length === 0) return
    setSubmitting(true)
    const payload = {
      edges: edges.map((e) => ({
        source_node_id: e.source,
        target_node_id: e.target,
        label: String(e.label ?? ""),
        justification: (e.data as any)?.justification ?? null,
      })),
    }
    try {
      const { data } = await api.post<ScoreResult>(`/api/sessions/${sessionId}/submit`, payload)
      const prevTotal = score ? Math.round(score.score.total * 100) : null
      const newTotal = Math.round(data.score.total * 100)
      if (prevTotal !== null) recordSubmitDelta(newTotal - prevTotal)
      setPrevScore(score ?? undefined)
      setScore(data)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !guided.active || guided.phase === "intercluster" || guided.phase === "free"

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">
        Loading canvas…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-800">Knowledge Canvas</span>
          <span className="text-sm text-gray-400">{edges.length} connections</span>
          {guided.active && guided.phase === "cluster" && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Group {guided.currentClusterIndex + 1}/{guided.clusterQueue.length}
            </span>
          )}
          {guided.active && guided.phase === "intercluster" && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              Zoom-out phase
            </span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || edges.length === 0 || !canSubmit}
          title={!canSubmit ? "Complete all groups before submitting" : undefined}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {submitting ? "Submitting…" : score ? "Resubmit Graph" : "Submit Graph"}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NodeTray nodes={trayNodes} />
        <div className="flex-1 overflow-hidden">
          <GraphCanvas allNodes={trayNodes} />
        </div>
        {score && (
          <ScorePanel
            score={score}
            prevScore={prevScore}
            onClose={() => setScore(null)}
            onRetry={() => setScore(null)}
          />
        )}
      </div>
    </div>
  )
}

export default function CanvasPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center text-gray-400">
        Loading canvas…
      </div>
    }>
      <CanvasPageInner />
    </Suspense>
  )
}
