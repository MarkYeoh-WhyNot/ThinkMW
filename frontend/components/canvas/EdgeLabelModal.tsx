"use client"

import { useState, useRef, useEffect } from "react"
import { useCanvasStore } from "@/lib/stores/canvas.store"

function getJustificationPrompt(label: string): string {
  const l = label.toLowerCase().trim()
  if (!l) return "Why does this connection exist?"
  if (l.includes("cause") || l.includes("leads to") || l.includes("result"))
    return "What specifically triggers or causes this?"
  if (l.includes("need") || l.includes("require") || l.includes("depend"))
    return "Why is this a dependency — what breaks without it?"
  if (l.includes("part") || l.includes("component") || l.includes("made of"))
    return "How does this component contribute to the whole?"
  if (l.includes("produce") || l.includes("creat") || l.includes("generat"))
    return "What is the mechanism that produces this output?"
  if (l.includes("represent") || l.includes("symbol") || l.includes("stand for"))
    return "In what context does one represent the other?"
  if (l.includes("oppos") || l.includes("against") || l.includes("contradict"))
    return "Under what conditions do these conflict?"
  return "Explain the relationship in one sentence — why does this connection hold?"
}

export default function EdgeLabelModal() {
  const { confirmEdgeLabel, setPendingEdge, pendingEdge } = useCanvasStore()
  const isEditing = !!pendingEdge?.edgeId
  const [label, setLabel] = useState(pendingEdge?.label ?? "")
  const [justification, setJustification] = useState(pendingEdge?.justification ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  // pendingEdge carries isNovel flag once semantic routing is wired;
  // for now treat as required when label is short/vague (< 3 words)
  const labelWords = label.trim().split(/\s+/).filter(Boolean).length
  const justificationRequired = labelWords <= 2 && label.trim().length > 0
  const canConfirm = label.trim().length > 0 &&
    (!justificationRequired || justification.trim().length > 0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const confirm = () => {
    if (!canConfirm) return
    confirmEdgeLabel(label.trim(), justification.trim() || undefined)
    setLabel("")
    setJustification("")
  }

  const cancel = () => {
    setPendingEdge(null)
    setLabel("")
    setJustification("")
  }

  const prompt = getJustificationPrompt(label)

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-5 w-84 border border-gray-200" style={{ width: "22rem" }}>
        <p className="text-sm font-bold text-gray-700 mb-1">
          {isEditing ? "Edit this connection" : "How does the first idea connect to the second?"}
        </p>
        <p className="text-xs text-gray-400 mb-3">
          Use your own words — describe the relationship as you understand it.
        </p>

        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel() }}
          placeholder='Describe the connection in your own words…'
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-600">
            {prompt}
          </label>
          {justificationRequired ? (
            <span className="text-xs text-orange-500 font-medium">required</span>
          ) : (
            <span className="text-xs text-gray-300">optional</span>
          )}
        </div>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Explain why this connection is true…"
          rows={3}
          className={`w-full px-3 py-2 border rounded-lg text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-600 placeholder-gray-300 transition-colors ${
            justificationRequired && !justification.trim()
              ? "border-orange-300 bg-orange-50"
              : "border-gray-200"
          }`}
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={cancel}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
