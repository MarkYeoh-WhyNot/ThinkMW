import type { Metadata } from "next"
import "../styles/globals.css"

export const metadata: Metadata = {
  title: "ThinkMW",
  description: "GraphRAG-powered knowledge assessment",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
