"use client"

import { useState } from "react"

type Mode = "login" | "signup"

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState<"student" | "teacher">("student")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)


  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    try {
      // Import inside handler to avoid SSR/hydration issues
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        const userRole = data.user?.user_metadata?.role ?? "student"
        window.location.href = userRole === "teacher" ? "/teacher" : "/student"
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName, role } },
        })
        console.log("[signup]", { user: data.user, error })
        if (error) throw error

        if (data.user && !data.user.identities?.length) {
          throw new Error("An account with this email already exists.")
        }

        // If email confirmation is still on, tell them to check email
        if (!data.session) {
          setError("Check your email for a confirmation link, then log in here.")
          setLoading(false)
          setMode("login")
          return
        }

        // Fire-and-forget: create user record in our DB (don't block redirect).
        // Identity and role are derived server-side from the JWT.
        if (data.session) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ display_name: displayName }),
          }).catch(() => {})
        }

        window.location.href = role === "teacher" ? "/teacher" : "/student"
      }
    } catch (err: any) {
      console.error("[auth error]", err)
      setError(err?.message ?? "Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-700 mb-1">ThinkMW</h1>
          <p className="text-sm text-gray-400">GraphRAG-powered knowledge assessment</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="flex rounded-lg border border-gray-200 p-1 mb-6 gap-1">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null) }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-medium ${
                mode === "login"
                  ? "bg-brand-600 text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null) }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-medium ${
                mode === "signup"
                  ? "bg-brand-600 text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Sign up
            </button>
          </div>

          <div className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Your full name"
                  autoComplete="name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@school.edu"
                autoComplete="email"
                suppressHydrationWarning
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="8+ characters"
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                suppressHydrationWarning
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  I am a
                </label>
                <div className="flex gap-2">
                  {(["student", "teacher"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors capitalize font-medium ${
                        role === r
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading
                ? "Please wait…"
                : mode === "login"
                ? "Log in"
                : "Create account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
