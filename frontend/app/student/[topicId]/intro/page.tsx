"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import api from "@/lib/api/client"

interface TrayNode {
  id: string
  canonical_name: string
  cluster_tag: string | null
}

interface TopicMeta {
  id: string
  title: string
  subject: string
}

interface ClusterSummary {
  name: string
  nodes: TrayNode[]
}

function matchPrimedNodes(text: string, nodes: TrayNode[]): string[] {
  if (!text.trim()) return []
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 2)
  return nodes
    .filter((n) =>
      words.some((w) =>
        n.canonical_name.toLowerCase().includes(w) || w.includes(n.canonical_name.toLowerCase())
      )
    )
    .map((n) => n.id)
}

function groupClusters(nodes: TrayNode[]): ClusterSummary[] {
  const map: Record<string, TrayNode[]> = {}
  for (const n of nodes) {
    const k = n.cluster_tag ?? "General"
    if (!map[k]) map[k] = []
    map[k].push(n)
  }
  return Object.entries(map)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, ns]) => ({ name, nodes: ns }))
}

export default function IntroPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const router = useRouter()

  const [topic, setTopic] = useState<TopicMeta | null>(null)
  const [nodes, setNodes] = useState<TrayNode[]>([])
  const [clusters, setClusters] = useState<ClusterSummary[]>([])
  const [priorText, setPriorText] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<TopicMeta>(`/api/topics/${topicId}`),
      api.get<TrayNode[]>(`/api/topics/${topicId}/nodes`),
    ]).then(([topicRes, nodesRes]) => {
      setTopic(topicRes.data)
      setNodes(nodesRes.data)
      setClusters(groupClusters(nodesRes.data))
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [topicId])

  const primedIds = matchPrimedNodes(priorText, nodes)

  function handleBegin() {
    const clusterOrder = clusters.map((c) => c.name)
    const params = new URLSearchParams()
    if (primedIds.length > 0) params.set("primed", primedIds.join(","))
    params.set("guided", "1")
    params.set("clusters", clusterOrder.join(","))
    router.push(`/student/${topicId}?${params.toString()}`)
  }

  function handleSkip() {
    router.push(`/student/${topicId}`)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">Loading…</div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl space-y-6">

        {/* Topic header */}
        <div className="text-center space-y-1">
          <span className="inline-block text-xs font-bold tracking-widest uppercase text-blue-500">
            {topic?.subject}
          </span>
          <h1 className="text-3xl font-bold text-gray-900">{topic?.title}</h1>
          <p className="text-sm text-gray-400 mt-1">
            You're about to build a knowledge map. We'll guide you through it one group at a time.
          </p>
        </div>

        {/* What's in this topic */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            What's in this topic
          </p>
          <div className="grid grid-cols-2 gap-3">
            {clusters.map((c) => (
              <div key={c.name} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-1">{c.name}</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  {c.nodes.slice(0, 3).map((n) => n.canonical_name).join(", ")}
                  {c.nodes.length > 3 && ` +${c.nodes.length - 3} more`}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {nodes.length} concepts across {clusters.length} groups — you'll map them one group at a time.
          </p>
        </div>

        {/* Prior knowledge */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800">What do you already know?</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Write freely about {topic?.title}. We'll highlight the concepts you mention on your map.
            </p>
          </div>
          <textarea
            value={priorText}
            onChange={(e) => setPriorText(e.target.value)}
            placeholder={`e.g. "I know that a PID controller adjusts output based on error…"`}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          {primedIds.length > 0 && (
            <p className="text-xs text-blue-500">
              ✦ {primedIds.length} concept{primedIds.length !== 1 ? "s" : ""} matched —
              they'll be highlighted on your map.
            </p>
          )}
        </div>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">How it works</p>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex gap-2">
              <span className="font-bold text-blue-300 w-4 flex-shrink-0">1.</span>
              We zoom into one group of concepts at a time and place them on your canvas.
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-300 w-4 flex-shrink-0">2.</span>
              Draw connections between them using your own relationship labels.
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-300 w-4 flex-shrink-0">3.</span>
              After all groups are done, zoom out and link the groups together.
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-300 w-4 flex-shrink-0">4.</span>
              Submit your graph and get scored with feedback on what you missed.
            </li>
          </ol>
        </div>

        {/* CTAs */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 py-3 border border-gray-200 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Skip — open free canvas
          </button>
          <button
            onClick={handleBegin}
            className="flex-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Begin guided mapping →
          </button>
        </div>

      </div>
    </div>
  )
}
