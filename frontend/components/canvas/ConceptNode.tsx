"use client"

import { memo } from "react"
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

  return (
    <div
      className={clsx(
        "rounded-lg border-2 text-sm font-semibold min-w-[100px] max-w-[180px] text-center shadow-sm transition-all",
        colourClass,
        selected && "ring-2 ring-offset-1 ring-blue-400 shadow-md",
      )}
    >
      {/* All four sides accept both incoming and outgoing connections */}
      <Handle type="target" position={Position.Top}    id="top-t"    className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Top}    id="top-s"    className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Left}   id="left-t"   className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Left}   id="left-s"   className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Right}  id="right-t"  className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Right}  id="right-s"  className={HANDLE_CLASS} />

      <div className="px-3 py-2">
        <span>{data.label}</span>
      </div>

      {selected && data.description && (
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
