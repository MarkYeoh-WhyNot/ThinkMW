"use client"

interface ScoreBreakdown {
  coverage: number
  novel_valid: number
  structure: number
  completeness: number
  total: number
}

export interface MissedEdge {
  source_name: string
  target_name: string
  source_cluster?: string
  target_cluster?: string
  guiding_question?: string
  type: string
}

export interface ScoreResult {
  score: ScoreBreakdown
  missed_edges: MissedEdge[]
  novel_edges: { source_name: string; target_name: string; label: string; llm_verdict: string }[]
  attempt_number: number
}

const VERDICT_COLOUR: Record<string, string> = {
  valid:   "text-green-600 bg-green-50 border-green-200",
  weak:    "text-yellow-600 bg-yellow-50 border-yellow-200",
  invalid: "text-red-600 bg-red-50 border-red-200",
}

// ── Cluster heatmap ────────────────────────────────────────────────────────

function clusterGaps(missed: MissedEdge[]): Record<string, MissedEdge[]> {
  const map: Record<string, MissedEdge[]> = {}
  for (const e of missed) {
    const cluster = e.source_cluster ?? e.target_cluster ?? "General"
    if (!map[cluster]) map[cluster] = []
    map[cluster].push(e)
  }
  return map
}

function gapColour(count: number, max: number): string {
  const ratio = max > 0 ? count / max : 0
  if (ratio >= 0.7) return "bg-red-400"
  if (ratio >= 0.4) return "bg-orange-300"
  return "bg-yellow-200"
}

function ClusterHeatmap({ missed }: { missed: MissedEdge[] }) {
  if (missed.length === 0) return null
  const grouped = clusterGaps(missed)
  const clusters = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)
  const max = clusters[0][1].length

  return (
    <div className="px-4 py-4 border-b">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
        Where the gaps are
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Clusters with more gaps need more attention.
      </p>
      <div className="space-y-2">
        {clusters.map(([cluster, edges]) => (
          <div key={cluster}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-700 font-medium">{cluster}</span>
              <span className="text-gray-400">{edges.length} connection{edges.length !== 1 ? "s" : ""} to explore</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${gapColour(edges.length, max)}`}
                style={{ width: `${(edges.length / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Guiding questions (top 2 clusters only) ───────────────────────────────

function GuidingQuestions({ missed }: { missed: MissedEdge[] }) {
  const grouped = clusterGaps(missed)
  const topClusters = Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 2)

  const questions = topClusters
    .flatMap(([, edges]) => edges)
    .map(e => e.guiding_question)
    .filter((q): q is string => !!q && q.trim().length > 0)
    .slice(0, 2)

  if (questions.length === 0) return null

  return (
    <div className="px-4 py-4 border-b">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
        Think about this
      </p>
      <p className="text-xs text-gray-400 mb-3">
        These questions point toward connections you may have missed.
      </p>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={i} className="text-xs text-gray-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 leading-relaxed">
            💭 {q}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Score bar ─────────────────────────────────────────────────────────────

function Delta({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) return null
  const positive = value > 0
  return (
    <span className={`text-xs font-semibold ml-1 ${positive ? "text-green-600" : "text-red-500"}`}>
      {positive ? "▲" : "▼"}{Math.round(Math.abs(value) * 100)}%
    </span>
  )
}

function ScoreBar({ label, value, prev }: { label: string; value: number; prev?: number }) {
  const pct = Math.round(value * 100)
  const delta = prev !== undefined ? value - prev : undefined
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">
          {pct}%
          {delta !== undefined && <Delta value={delta} />}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────

export default function ScorePanel({
  score,
  prevScore,
  onClose,
  onRetry,
}: {
  score: ScoreResult
  prevScore?: ScoreResult
  onClose: () => void
  onRetry: () => void
}) {
  const total = Math.round(score.score.total * 100)
  const prevTotal = prevScore ? Math.round(prevScore.score.total * 100) : undefined
  const colour = total >= 75 ? "text-green-600" : total >= 50 ? "text-yellow-600" : "text-red-500"
  const totalDelta = prevTotal !== undefined ? total - prevTotal : undefined
  const showExactGaps = score.attempt_number >= 2 && score.missed_edges.length > 0

  return (
    <aside className="w-72 flex-shrink-0 border-l bg-white flex flex-col overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-gray-800">
          Results
          {score.attempt_number > 1 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              attempt {score.attempt_number}
            </span>
          )}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      {/* Total score */}
      <div className="px-4 py-5 text-center border-b">
        <p className={`text-5xl font-bold ${colour}`}>{total}</p>
        <p className="text-sm text-gray-400 mt-1">
          out of 100
          {totalDelta !== undefined && (
            <span className={`ml-2 font-semibold ${totalDelta >= 0 ? "text-green-600" : "text-red-500"}`}>
              ({totalDelta > 0 ? "+" : ""}{totalDelta} pts)
            </span>
          )}
        </p>
        {total < 50 && score.attempt_number === 1 && (
          <p className="text-xs text-gray-400 mt-2">
            Good start — use the questions below to guide your next attempt.
          </p>
        )}
      </div>

      {/* Breakdown */}
      <div className="px-4 py-4 border-b space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Breakdown</p>
        <ScoreBar label="Edge Coverage (40%)"     value={score.score.coverage}     prev={prevScore?.score.coverage} />
        <ScoreBar label="Novel Connections (30%)" value={score.score.novel_valid}  prev={prevScore?.score.novel_valid} />
        <ScoreBar label="Graph Structure (20%)"   value={score.score.structure}    prev={prevScore?.score.structure} />
        <ScoreBar label="Node Completeness (10%)" value={score.score.completeness} prev={prevScore?.score.completeness} />
      </div>

      {/* Revise & Resubmit */}
      <div className="px-4 py-3 border-b">
        <button
          onClick={onRetry}
          className="w-full py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Revise &amp; Resubmit
        </button>
        <p className="text-xs text-gray-400 text-center mt-1">
          Keep your graph — add or change connections and submit again.
        </p>
      </div>

      {/* Cluster heatmap — always shown */}
      <ClusterHeatmap missed={score.missed_edges} />

      {/* Guiding questions — always shown */}
      <GuidingQuestions missed={score.missed_edges} />

      {/* Exact gaps — only from attempt 2 onwards */}
      {showExactGaps && (
        <div className="px-4 py-4 border-b">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
            Specific connections missed ({score.missed_edges.length})
          </p>
          <p className="text-xs text-gray-400 mb-3">
            Unlocked after your first attempt. Think about why each pair connects before your next submission.
          </p>
          <div className="space-y-2">
            {score.missed_edges.map((e, i) => (
              <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-medium text-blue-700">{e.source_name}</span>
                <span className="text-gray-300 mx-2">↔</span>
                <span className="font-medium text-blue-700">{e.target_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showExactGaps && score.missed_edges.length > 0 && score.attempt_number === 1 && (
        <div className="px-4 py-3 border-b">
          <p className="text-xs text-gray-400 text-center">
            Specific missed connections unlock after your second attempt.
          </p>
        </div>
      )}

      {/* Novel edges */}
      {score.novel_edges.length > 0 && (
        <div className="px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
            Your Original Ideas ({score.novel_edges.length})
          </p>
          <p className="text-xs text-gray-400 mb-3">
            Connections you made that go beyond the standard model.
          </p>
          <div className="space-y-2">
            {score.novel_edges.map((e, i) => (
              <div key={i} className={`text-xs rounded-lg px-3 py-2 border ${VERDICT_COLOUR[e.llm_verdict] ?? "text-gray-600 bg-gray-50 border-gray-200"}`}>
                <span className="font-medium">{e.source_name}</span>
                <span className="mx-1 opacity-60">→</span>
                <span className="font-medium">{e.target_name}</span>
                <span className="ml-1 opacity-70">"{e.label}"</span>
                <span className="ml-2 font-semibold capitalize">[{e.llm_verdict}]</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
