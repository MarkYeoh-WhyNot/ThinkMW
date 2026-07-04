"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import api from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"

interface Topic {
  id: string
  title: string
  subject: string
  status: string
}

export default function StudentPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return }
      setUserName(session.user.user_metadata?.display_name ?? session.user.email ?? "")
    })
    api.get<Topic[]>("/api/topics/")
      .then(({ data }) => setTopics(data.filter((t) => t.status === "ready")))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-8 py-4 flex items-center gap-4">
        <h1 className="text-xl font-bold text-brand-700 flex-1">ThinkMW</h1>
        <Link href="/student/library" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
          My library
        </Link>
        <span className="text-sm text-gray-400">{userName}</span>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg"
        >
          Log out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h2 className="text-lg font-semibold mb-6">Choose a Topic</h2>

        {loading ? (
          <p className="text-sm text-gray-400">Loading topics…</p>
        ) : topics.length === 0 ? (
          <p className="text-sm text-gray-400">No topics available yet. Ask your teacher to upload one.</p>
        ) : (
          <div className="space-y-3">
            {topics.map((t) => (
              <Link
                key={t.id}
                href={`/student/${t.id}`}
                className="block bg-white border rounded-xl px-5 py-4 hover:border-brand-500 hover:shadow-sm transition-all"
              >
                <p className="font-medium text-gray-800">{t.title}</p>
                <p className="text-sm text-gray-400 mt-0.5">{t.subject}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
