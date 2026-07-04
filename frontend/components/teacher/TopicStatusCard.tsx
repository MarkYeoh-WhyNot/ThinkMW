"use client"

import Link from "next/link"

interface Topic {
  id: string
  title: string
  subject: string
  status: "processing" | "ready" | "error"
}

const STATUS = {
  processing: { label: "Generating graph…", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400 animate-pulse" },
  ready:      { label: "Ready",             color: "bg-green-100 text-green-700",   dot: "bg-green-500" },
  error:      { label: "Error",             color: "bg-red-100 text-red-700",       dot: "bg-red-500" },
}

export default function TopicStatusCard({
  topic,
  onDelete,
}: {
  topic: Topic
  onDelete?: (id: string) => void
}) {
  const s = STATUS[topic.status]

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`Delete "${topic.title}"? This removes the graph and all related data.`)) {
      onDelete?.(topic.id)
    }
  }

  const inner = (
    <div className={`bg-white border rounded-xl px-5 py-4 flex items-center justify-between shadow-sm transition-colors ${
      topic.status === "ready" ? "hover:border-blue-400 hover:shadow-md cursor-pointer" : ""
    }`}>
      <div>
        <p className="font-medium text-gray-800">{topic.title}</p>
        <p className="text-sm text-gray-400">
          {topic.subject} · {topic.id.slice(0, 8)}
          {topic.status === "ready" && (
            <span className="ml-2 text-blue-500 text-xs">Open canvas →</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full ${s.color}`}>
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          {s.label}
        </span>
        {onDelete && (
          <button
            onClick={handleDelete}
            title="Delete topic"
            className="text-xs text-gray-300 hover:text-red-500 border border-transparent hover:border-red-200 rounded-md px-2 py-1 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )

  if (topic.status === "ready") {
    return <Link href={`/student/${topic.id}/intro`}>{inner}</Link>
  }

  return inner
}
