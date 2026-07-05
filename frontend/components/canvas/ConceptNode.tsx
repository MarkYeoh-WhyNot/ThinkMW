"use client"

import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { clsx } from "clsx"

const CLUSTER_COLOURS: Record<string, string> = {
  default:  "border-blue-500 bg-blue-50 text-blue-800",
  process:  "border-green-500 bg-green-50 text-green-800",
  molecule: "border-orange-500 bg-orange-50 text-orange-800",
  location: "border-purple-500 bg-purple-50 text-purple-800",
}

interface ConceptNodeData {
  label: string
  description?: string
  cluster?: string
}

const HANDLE_CLASS = "!w-2.5 !h-2.5 !border-2 !border-white !bg-blue-400 opacity-0 hover:opacity-100 transition-opacity"

function ConceptNode({ data, selected }: NodeProps<ConceptNodeData>) {
  const colourClass = CLUSTER_COLOURS[data.cluster ?? "default"] ?? CLUSTER_COLOURS.default
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      onDoubleClick={() => setExpanded((v) => !v)}
      className={clsx(
        "rounded-lg border-2 text-sm font-semibold min-w-[100px] max-w-[180px] text-center shadow-sm transition-all",
        colourClass,
        selected && "ring-2 ring-offset-1 ring-blue-400 shadow-md",
      )}
    >
      {/* All four sides accept both incoming and outgoing connections.
          One handle per side (not a stacked target+source pair) — React
          Flow positions same-side handles at identical coordinates, which
          made the underlying handle unreachable to pointer hit-testing. */}
      <Handle type="source" position={Position.Top}    id="top"    className={HANDLE_CLASS} isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Left}   id="left"   className={HANDLE_CLASS} isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Right}  id="right"  className={HANDLE_CLASS} isConnectableStart isConnectableEnd />

      <div className="px-3 py-2">
        <span>{data.label}</span>
      </div>

      {expanded && data.description && (
        <div className="px-3 pb-2 border-t border-current border-opacity-10">
          <p className="text-[10px] font-normal leading-snug opacity-75 mt-1 text-left">
            {data.description}
          </p>
        </div>
      )}
    </div>
  )
}

export default memo(ConceptNode)
