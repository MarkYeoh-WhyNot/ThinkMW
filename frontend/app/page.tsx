import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold text-brand-700">ThinkMW</h1>
      <p className="text-gray-500">GraphRAG-powered knowledge assessment</p>
      <div className="flex gap-4">
        <Link
          href="/teacher"
          className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium"
        >
          Teacher Dashboard
        </Link>
        <Link
          href="/student"
          className="px-6 py-3 border border-brand-600 text-brand-600 rounded-lg hover:bg-brand-50 font-medium"
        >
          Student Canvas
        </Link>
      </div>
    </main>
  )
}
