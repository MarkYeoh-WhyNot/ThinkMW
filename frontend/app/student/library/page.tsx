"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import api from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"

interface Attempt {
  attempt_number: number
  score: number
  submitted_at: string
  score_breakdown: {
    coverage: number
    novel_valid: number
    structure: number
    completeness: number
  }
}

interface LibraryTopic {
  topic_id: string
  title: string
  subject: string
  attempts: Attempt[]
  best_score: number
  attempt_count: number
  last_attempted_at: string
}

interface ScoreWeights {
  coverage: number
  novel_valid: number
  structure: number
  completeness: number
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  coverage: 0.4,
  novel_valid: 0.3,
  structure: 0.2,
  completeness: 0.1,
}

const pct = (w: number) => `${Math.round(w * 100)}% weight`

function ScoreSpark({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) return null
  const max = 100
  return (
    <div className="flex items-end gap-1 h-6">
      {attempts.map((a) => (
        <div
          key={a.attempt_number}
          title={`Attempt ${a.attempt_number}: ${a.score}%`}
          className="w-1.5 rounded-sm bg-brand-400 transition-all"
          style={{ height: `${Math.max(15, (a.score / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function scoreTrend(attempts: Attempt[]): { label: string; cls: string } {
  if (attempts.length < 2) return { label: "—", cls: "text-gray-400" }
  const delta = attempts[attempts.length - 1].score - attempts[attempts.length - 2].score
  if (delta > 2) return { label: `↑${delta}`, cls: "text-green-500" }
  if (delta < -2) return { label: `↓${Math.abs(delta)}`, cls: "text-red-400" }
  return { label: "—", cls: "text-gray-400" }
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-7 text-right">{score}%</span>
    </div>
  )
}

export default function LibraryPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<LibraryTopic[]>([])
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<LibraryTopic | null>(null)
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return }
      setUserName(session.user.user_metadata?.display_name ?? session.user.email ?? "")
    })

    api
      .get<{ topics: LibraryTopic[]; weights?: ScoreWeights }>("/api/library/")
      .then(({ data }) => {
        setTopics(data.topics)
        if (data.weights) setWeights(data.weights)
        if (data.topics.length > 0) setSelected(data.topics[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Group topics by subject
  const bySubject = topics.reduce<Record<string, LibraryTopic[]>>((acc, t) => {
    if (!acc[t.subject]) acc[t.subject] = []
    acc[t.subject].push(t)
    return acc
  }, {})

  const totalTopics = topics.length
  const avgScore =
    topics.length > 0
      ? Math.round(topics.reduce((s, t) => s + t.best_score, 0) / topics.length)
      : 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <h1 className="text-base font-bold text-brand-700 flex-1">ThinkMW</h1>
        <Link
          href="/student"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Topics
        </Link>
        <span className="text-sm font-medium text-brand-600">Library</span>
        <span className="text-sm text-gray-400">{userName}</span>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg"
        >
          Log out
        </button>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 flex gap-8">
        {/* Left column — topic list */}
        <div className="w-72 flex-shrink-0">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Topics</p>
              <p className="text-2xl font-semibold text-gray-800">{totalTopics}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Avg score</p>
              <p className="text-2xl font-semibold text-gray-800">{avgScore}%</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : topics.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400 mb-3">No topics mapped yet.</p>
              <Link
                href="/student"
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Start your first topic →
              </Link>
            </div>
          ) : (
            Object.entries(bySubject).map(([subject, subTopics]) => (
              <div key={subject} className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  {subject}
                </p>
                <div className="flex flex-col gap-2">
                  {subTopics.map((t) => {
                    const trend = scoreTrend(t.attempts)
                    const isSelected = selected?.topic_id === t.topic_id
                    return (
                      <button
                        key={t.topic_id}
                        onClick={() => setSelected(t)}
                        className={`text-left w-full bg-white rounded-xl border px-4 py-3 transition-all ${
                          isSelected
                            ? "border-brand-400 shadow-sm bg-brand-50"
                            : "border-gray-200 hover:border-brand-300"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-800 mb-1.5 leading-snug">
                          {t.title}
                        </p>
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-lg font-semibold text-gray-800">
                              {t.best_score}%
                            </span>
                            <span className={`text-xs ml-1.5 ${trend.cls}`}>
                              {trend.label}
                            </span>
                          </div>
                          <div className="flex-1" />
                          <ScoreSpark attempts={t.attempts} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {t.attempt_count} attempt{t.attempt_count !== 1 ? "s" : ""}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right column — topic detail */}
        {selected ? (
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-gray-400 mb-1">{selected.subject}</p>
                  <h2 className="text-xl font-semibold text-gray-800">{selected.title}</h2>
                </div>
                <Link
                  href={`/student/${selected.topic_id}/intro`}
                  className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium"
                >
                  Remap →
                </Link>
              </div>

              {/* Attempt history */}
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Attempt history
              </h3>
              <div className="space-y-3 mb-6">
                {selected.attempts.map((a) => (
                  <div key={a.attempt_number} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-16">
                      Attempt {a.attempt_number}
                    </span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${a.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-10 text-right">
                      {a.score}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Score breakdown for best attempt */}
              {selected.attempts.length > 0 && (() => {
                const best = [...selected.attempts].sort((a, b) => b.score - a.score)[0]
                const bd = best.score_breakdown
                return (
                  <>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                      Best attempt breakdown
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Edge coverage</span>
                          <span className="text-gray-400">{pct(weights.coverage)}</span>
                        </div>
                        <ScoreBar score={Math.round(bd.coverage * 100)} color="bg-blue-400" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Novel connections</span>
                          <span className="text-gray-400">{pct(weights.novel_valid)}</span>
                        </div>
                        <ScoreBar score={Math.round(bd.novel_valid * 100)} color="bg-purple-400" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Graph structure</span>
                          <span className="text-gray-400">{pct(weights.structure)}</span>
                        </div>
                        <ScoreBar score={Math.round(bd.structure * 100)} color="bg-amber-400" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Concept coverage</span>
                          <span className="text-gray-400">{pct(weights.completeness)}</span>
                        </div>
                        <ScoreBar score={Math.round(bd.completeness * 100)} color="bg-green-400" />
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Cross-topic note (placeholder — will expand with cross-topic query) */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Cross-topic connections
              </h3>
              {topics.length < 2 ? (
                <p className="text-sm text-gray-400">
                  Map at least 2 topics to see shared concepts across subjects.
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  Concepts from <span className="text-gray-600 font-medium">{selected.title}</span> that
                  appear in your other topics will surface here after your next session.
                </p>
              )}
            </div>
          </div>
        ) : (
          !loading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">Select a topic to see details.</p>
            </div>
          )
        )}
      </main>
    </div>
  )
}
