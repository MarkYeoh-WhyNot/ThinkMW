"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import TopicStatusCard from "@/components/teacher/TopicStatusCard"

interface Topic {
  id: string
  title: string
  subject: string
  status: "processing" | "ready" | "error"
}

export default function TeacherPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<Topic[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [userName, setUserName] = useState("")

  // Track active polling intervals so we can clean them up
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return }
      setUserName(session.user.user_metadata?.display_name ?? session.user.email ?? "")
    })
    api.get<Topic[]>("/api/topics/")
      .then(({ data }) => {
        setTopics(data)
        data.filter((t) => t.status === "processing").forEach((t) => startPolling(t.id))
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => {
      // Clear all intervals on unmount
      Object.values(pollingRefs.current).forEach(clearInterval)
    }
  }, [])

  function startPolling(topicId: string) {
    // Don't start a second interval for the same topic
    if (pollingRefs.current[topicId]) return

    const interval = setInterval(async () => {
      try {
        const { data } = await api.get<{ status: string }>(`/api/topics/${topicId}/status`)
        setTopics((prev) =>
          prev.map((t) => (t.id === topicId ? { ...t, status: data.status as Topic["status"] } : t))
        )
        if (data.status === "ready" || data.status === "error") {
          clearInterval(interval)
          delete pollingRefs.current[topicId]
        }
      } catch {
        clearInterval(interval)
        delete pollingRefs.current[topicId]
      }
    }, 3000)

    pollingRefs.current[topicId] = interval
  }

  async function handleDelete(topicId: string) {
    try {
      await api.delete(`/api/topics/${topicId}`)
      setTopics((prev) => prev.filter((t) => t.id !== topicId))
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Delete failed")
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title || !subject) return

    setUploading(true)
    setError(null)

    try {
      const form = new FormData()
      form.append("title", title)
      form.append("subject", subject)
      form.append("file", file)

      const { data } = await api.post<Topic>("/api/topics/", form)
      setTopics((prev) => [data, ...prev])

      // Reset form
      setTitle("")
      setSubject("")
      setFile(null)
      const input = document.getElementById("pdf-input") as HTMLInputElement
      if (input) input.value = ""

      startPolling(data.id)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-700">ThinkMW — Teacher Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{userName}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Upload card */}
        <section className="bg-white rounded-xl border shadow-sm p-8">
          <h2 className="text-lg font-semibold mb-6">Upload Topic PDF</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setError(null) }}
                  placeholder="e.g. Photosynthesis"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => { setSubject(e.target.value); setError(null) }}
                  placeholder="e.g. Biology"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                file ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const dropped = e.dataTransfer.files[0]
                if (dropped?.type === "application/pdf") { setFile(dropped); setError(null) }
              }}
            >
              {file ? (
                <div className="space-y-1">
                  <p className="font-medium text-blue-700">{file.name}</p>
                  <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setError(null) }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-gray-500 text-sm">Drag & drop a PDF here, or</p>
                  <label className="cursor-pointer text-blue-600 text-sm font-medium hover:underline">
                    browse to select
                    <input
                      id="pdf-input"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null) }}
                    />
                  </label>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={uploading || !file || !title || !subject}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? "Uploading…" : "Upload & Generate Graph"}
            </button>
          </form>
        </section>

        {/* Topics list */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Topics</h2>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-gray-400">No topics yet. Upload a PDF to get started.</p>
          ) : (
            topics.map((t) => <TopicStatusCard key={t.id} topic={t} onDelete={handleDelete} />)
          )}
        </section>
      </main>
    </div>
  )
}
