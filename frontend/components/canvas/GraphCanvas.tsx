"use client"

import { useCallback, useRef } from "react"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ConnectionMode,
  type NodeTypes,
} from "reactflow"
import "reactflow/dist/style.css"

import { useCanvasStore } from "@/lib/stores/canvas.store"
import ConceptNode from "./ConceptNode"
import EdgeLabelModal from "./EdgeLabelModal"
import ClusterGuide, { type TrayNode } from "./ClusterGuide"

const nodeTypes: NodeTypes = {
  concept: ConceptNode,
}

// Lives inside ReactFlow so it can call useReactFlow
function FitViewProxy({ fitViewRef }: { fitViewRef: React.MutableRefObject<((opts?: any) => void) | null> }) {
  const { fitView } = useReactFlow()
  fitViewRef.current = fitView
  return null
}

function NudgeBanner() {
  const { behaviour, dismissNudge } = useCanvasStore()
  if (!behaviour.nudge) return null
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[420px] max-w-[90%]">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-md flex items-start gap-3">
        <span className="text-amber-500 text-base mt-0.5 flex-shrink-0">💡</span>
        <p className="text-xs text-amber-800 leading-relaxed flex-1">{behaviour.nudge}</p>
        <button
          onClick={dismissNudge}
          className="text-amber-400 hover:text-amber-600 text-sm leading-none flex-shrink-0 ml-1"
          aria-label="Dismiss"
        >×</button>
      </div>
    </div>
  )
}

function CanvasPrompt({ hasNodes }: { hasNodes: boolean }) {
  const { guided } = useCanvasStore()
  if (hasNodes) return null

  const message = guided.active && guided.phase === "cluster"
    ? "Concepts are being placed — draw connections between them"
    : guided.active && guided.phase === "intercluster"
    ? "Now connect concepts across different groups"
    : "Drag concepts from the left tray to begin"

  const sub = guided.active
    ? "Click and drag from a node handle to another node to draw a relationship"
    : "Click a node to see its definition"

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center">
        <p className="text-gray-300 text-sm font-medium">{message}</p>
        <p className="text-gray-200 text-xs mt-1">{sub}</p>
      </div>
    </div>
  )
}

interface GraphCanvasProps {
  allNodes?: TrayNode[]
}

export default function GraphCanvas({ allNodes = [] }: GraphCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, startEditEdge, pendingEdge, guided } =
    useCanvasStore()

  // fitView is only available inside ReactFlow — proxy it via a ref
  const fitViewRef = useRef<((opts?: any) => void) | null>(null)
  const triggerFitView = useCallback((opts?: any) => {
    fitViewRef.current?.(opts)
  }, [])

  return (
    <div className="flex flex-col w-full h-full">
      {/* Guide bar sits above ReactFlow, outside its DOM tree */}
      {guided.active && (
        <ClusterGuide allNodes={allNodes} onFitView={triggerFitView} />
      )}

      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeDoubleClick={(_, edge) => startEditEdge(edge)}
          connectionMode={ConnectionMode.Loose}
          fitView
          deleteKeyCode="Backspace"
        >
          <Background gap={24} color="#d1d5db" />
          <Controls />
          <MiniMap nodeColor="#1a56db" maskColor="rgba(0,0,0,0.05)" />
          <FitViewProxy fitViewRef={fitViewRef} />
        </ReactFlow>

        <CanvasPrompt hasNodes={nodes.length > 0} />
        <NudgeBanner />
        {pendingEdge && <EdgeLabelModal />}
      </div>
    </div>
  )
}
