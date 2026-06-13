"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import { Plus, Trash2, Workflow } from "lucide-react"

import type {
  MindmapContent,
  MindmapNodeRecord,
  MindmapStyle,
} from "@/lib/note-content"
import {
  createDefaultMindmapContent,
  CURRENT_MINDMAP_LAYOUT_VERSION,
  mindmapContentToRecords,
  mindmapRecordsToContent,
  mindmapStyles,
} from "@/lib/note-content"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type MindmapNodeData = {
  label: string
  isRoot: boolean
  style: MindmapStyle
  onLabelChange: (id: string, label: string) => void
}

type MindmapCanvasNode = Node<MindmapNodeData, "mindmap">
type MindmapCanvasEdge = Edge<{ style: MindmapStyle }>

const SOURCE_HANDLE_IDS = {
  top: "source-top",
  right: "source-right",
  bottom: "source-bottom",
  left: "source-left",
} as const

const TARGET_HANDLE_IDS = {
  top: "target-top",
  right: "target-right",
  bottom: "target-bottom",
  left: "target-left",
} as const

type SourceHandleId = (typeof SOURCE_HANDLE_IDS)[keyof typeof SOURCE_HANDLE_IDS]
type TargetHandleId = (typeof TARGET_HANDLE_IDS)[keyof typeof TARGET_HANDLE_IDS]

const mindmapStyleLabels: Record<MindmapStyle, string> = {
  "concept-map": "Concept map",
  flowchart: "Flowchart",
  "bubble-map": "Bubble map",
  "tree-diagram": "Tree diagram",
  "timeline-map": "Timeline map",
  // "double-bubble": "Double bubble",
  // fishbone: "Fishbone",
  "org-chart": "Org chart",
  // matrix: "Matrix",
}

function getStylePreset(style: MindmapStyle) {
  switch (style) {
    case "flowchart":
      return { edgeType: "smoothstep", background: BackgroundVariant.Lines }
    case "tree-diagram":
    case "org-chart":
      return { edgeType: "smoothstep", background: BackgroundVariant.Lines }
    case "timeline-map":
    // case "fishbone":
    // case "matrix":
    //   return { edgeType: "straight", background: BackgroundVariant.Cross }
    case "bubble-map":
    // case "double-bubble":
    //   return { edgeType: "default", background: BackgroundVariant.Dots }
    case "concept-map":
    default:
      return { edgeType: "smoothstep", background: BackgroundVariant.Dots }
  }
}

function normalizeContent(value: MindmapContent) {
  const base = value.items.length > 0 ? value : createDefaultMindmapContent(value.style)
  const records = mindmapContentToRecords(base)

  return {
    content: {
      ...base,
      layoutVersion: CURRENT_MINDMAP_LAYOUT_VERSION,
    },
    nodes: layoutNodesForStyle(records.nodes, records.edges, base.style),
    edges: records.edges,
  }
}

function collectBranchIds(startId: string, edges: MindmapCanvasEdge[]) {
  const ids = new Set<string>([startId])
  const queue = [startId]

  while (queue.length > 0) {
    const current = queue.shift()!

    for (const edge of edges) {
      if (edge.source !== current || ids.has(edge.target)) {
        continue
      }

      ids.add(edge.target)
      queue.push(edge.target)
    }
  }

  return ids
}

function getNodePositions(
  node: MindmapNodeRecord,
  parentId: string | undefined,
  style: MindmapStyle
) {
  const position = node.position ?? { x: 0, y: 0 }

  if (node.id === "root") {
    if (style === "flowchart" || style === "org-chart") {
      return { sourcePosition: Position.Bottom, targetPosition: Position.Top }
    }

    return { sourcePosition: Position.Right, targetPosition: Position.Left }
  }

  if (style === "flowchart" || style === "org-chart") {
    return { sourcePosition: Position.Bottom, targetPosition: Position.Top }
  }

  if (style === "tree-diagram" || style === "timeline-map") {
    return { sourcePosition: Position.Right, targetPosition: Position.Left }
  }

  // if (style === "fishbone") {
  //   return {
  //     sourcePosition: Position.Right,
  //     targetPosition: position.y < 220 ? Position.Bottom : Position.Top,
  //   }
  // }

  return {
    sourcePosition: parentId && position.x < 320 ? Position.Left : Position.Right,
    targetPosition: parentId && position.x < 320 ? Position.Right : Position.Left,
  }
}

function buildParentMap(edges: MindmapCanvasEdge[]) {
  const parentMap = new Map<string, string>()

  for (const edge of edges) {
    parentMap.set(edge.target, edge.source)
  }

  return parentMap
}

function buildChildrenMap(edges: MindmapCanvasEdge[]) {
  const children = new Map<string, string[]>()

  for (const edge of edges) {
    const siblings = children.get(edge.source) ?? []
    siblings.push(edge.target)
    children.set(edge.source, siblings)
  }

  return children
}

function getTreeLevels(nodes: MindmapNodeRecord[], edges: MindmapCanvasEdge[]) {
  const children = buildChildrenMap(edges)
  const knownIds = new Set(nodes.map((node) => node.id))
  const levels = new Map<string, number>([["root", 0]])
  const queue = ["root"]

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentLevel = levels.get(current) ?? 0

    for (const childId of children.get(current) ?? []) {
      if (!knownIds.has(childId) || levels.has(childId)) {
        continue
      }

      levels.set(childId, currentLevel + 1)
      queue.push(childId)
    }
  }

  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, 1)
    }
  }

  return levels
}

function createSubtreeOrder(
  nodeId: string,
  children: Map<string, string[]>,
  nextIndex: { value: number },
  order: Map<string, number>
) {
  const nodeChildren = children.get(nodeId) ?? []

  if (nodeChildren.length === 0) {
    order.set(nodeId, nextIndex.value)
    nextIndex.value += 1
    return
  }

  for (const childId of nodeChildren) {
    createSubtreeOrder(childId, children, nextIndex, order)
  }

  const childOrders = nodeChildren
    .map((childId) => order.get(childId))
    .filter((value): value is number => value !== undefined)

  if (childOrders.length === 0) {
    order.set(nodeId, nextIndex.value)
    nextIndex.value += 1
    return
  }

  order.set(nodeId, (childOrders[0] + childOrders[childOrders.length - 1]) / 2)
}

function offsetNodePositions(
  positions: Map<string, { x: number; y: number }>,
  offsetX: number,
  offsetY: number
) {
  return new Map(
    Array.from(positions.entries()).map(([nodeId, position]) => [
      nodeId,
      {
        x: position.x + offsetX,
        y: position.y + offsetY,
      },
    ])
  )
}

function layoutTreeDiagram(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[]
) {
  const children = buildChildrenMap(edges)
  const positions = new Map<string, { x: number; y: number }>()
  let cursorY = 0

  function place(nodeId: string, depth: number): number {
    const childIds = children.get(nodeId) ?? []
    const x = depth * 300

    if (childIds.length === 0) {
      const y = cursorY
      cursorY += 170
      positions.set(nodeId, { x, y })
      return y
    }

    const childCenters = childIds.map((childId) => place(childId, depth + 1))
    const centerY = (childCenters[0] + childCenters[childCenters.length - 1]) / 2
    positions.set(nodeId, { x, y: centerY })
    return centerY
  }

  place("root", 0)

  return offsetNodePositions(positions, 160, 120)
}

function layoutConceptMap(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[]
) {
  const children = buildChildrenMap(edges)
  const positions = new Map<string, { x: number; y: number }>()
  const rootChildren = children.get("root") ?? []
  const leftRoots = rootChildren.filter((_, index) => index % 2 === 1)
  const rightRoots = rootChildren.filter((_, index) => index % 2 === 0)
  const nodeIds = new Set(nodes.map((node) => node.id))

  function countLeaves(nodeId: string): number {
    const childIds = (children.get(nodeId) ?? []).filter((childId) =>
      nodeIds.has(childId)
    )

    if (childIds.length === 0) {
      return 1
    }

    return childIds.reduce((sum, childId) => sum + countLeaves(childId), 0)
  }

  function placeBranch(
    nodeId: string,
    depth: number,
    direction: -1 | 1,
    cursor: { value: number }
  ): number {
    const childIds = (children.get(nodeId) ?? []).filter((childId) =>
      nodeIds.has(childId)
    )
    const x = direction * (depth * 290)

    if (childIds.length === 0) {
      const y = cursor.value
      cursor.value += 170
      positions.set(nodeId, { x, y })
      return y
    }

    const childCenters = childIds.map((childId) =>
      placeBranch(childId, depth + 1, direction, cursor)
    )
    const centerY = (childCenters[0] + childCenters[childCenters.length - 1]) / 2
    positions.set(nodeId, { x, y: centerY })
    return centerY
  }

  function placeSide(nodeIdsForSide: string[], direction: -1 | 1) {
    const leafCount = nodeIdsForSide.reduce(
      (sum, nodeId) => sum + countLeaves(nodeId),
      0
    )
    const cursor = {
      value: leafCount > 0 ? -((leafCount - 1) * 170) / 2 : 0,
    }

    for (const nodeId of nodeIdsForSide) {
      placeBranch(nodeId, 1, direction, cursor)
    }
  }

  positions.set("root", { x: 0, y: 0 })
  placeSide(leftRoots, -1)
  placeSide(rightRoots, 1)

  return offsetNodePositions(positions, 420, 220)
}

function layoutVerticalHierarchy(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[],
  {
    levelGap,
    siblingGap,
    offsetX,
    offsetY,
  }: {
    levelGap: number
    siblingGap: number
    offsetX: number
    offsetY: number
  }
) {
  const children = buildChildrenMap(edges)
  const positions = new Map<string, { x: number; y: number }>()
  let cursorX = 0

  function place(nodeId: string, depth: number): number {
    const childIds = children.get(nodeId) ?? []
    const y = depth * levelGap

    if (childIds.length === 0) {
      const x = cursorX
      cursorX += siblingGap
      positions.set(nodeId, { x, y })
      return x
    }

    const childCenters = childIds.map((childId) => place(childId, depth + 1))
    const centerX = (childCenters[0] + childCenters[childCenters.length - 1]) / 2
    positions.set(nodeId, { x: centerX, y })
    return centerX
  }

  place("root", 0)

  return offsetNodePositions(positions, offsetX, offsetY)
}

function layoutBubbleMap(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[]
) {
  const children = buildChildrenMap(edges)
  const positions = new Map<string, { x: number; y: number }>()
  const rootChildren = children.get("root") ?? []
  const center = { x: 420, y: 220 }
  const primaryRadius = 260
  const branchStep = 250

  positions.set("root", center)

  function placeBranch(nodeId: string, angle: number) {
    const parentPosition = positions.get(nodeId) ?? center
    const childIds = children.get(nodeId) ?? []

    if (childIds.length === 0) {
      return
    }

    const outwardX = Math.cos(angle)
    const outwardY = Math.sin(angle)
    const spread = childIds.length === 1 ? 0 : Math.min(1.25, 0.52 * (childIds.length - 1))

    childIds.forEach((childId, index) => {
      const ratio =
        childIds.length === 1 ? 0 : index / (childIds.length - 1) - 0.5
      const childAngle = angle + ratio * spread * 2
      const distance = branchStep + Math.abs(ratio) * 95
      const childOutwardX = Math.cos(childAngle)
      const childOutwardY = Math.sin(childAngle)

      positions.set(childId, {
        x: parentPosition.x + childOutwardX * distance + outwardX * 26,
        y: parentPosition.y + childOutwardY * distance + outwardY * 26,
      })

      placeBranch(childId, childAngle)
    })
  }

  rootChildren.forEach((nodeId, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2) / Math.max(rootChildren.length, 1)) * index

    positions.set(nodeId, {
      x: center.x + Math.cos(angle) * primaryRadius,
      y: center.y + Math.sin(angle) * primaryRadius * 0.88,
    })

    placeBranch(nodeId, angle)
  })

  return positions
}

function layoutTimelineMap(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[]
) {
  const children = buildChildrenMap(edges)
  const positions = new Map<string, { x: number; y: number }>()
  const rootChildren = children.get("root") ?? []
  const baselineY = 260
  const milestoneStartX = 460
  const milestoneGap = 320
  const calloutDistance = 180
  const calloutSpread = 140
  const extensionGap = 210

  positions.set("root", { x: 150, y: baselineY })

  function placeCallouts(
    parentId: string,
    parentX: number,
    parentY: number,
    preferredSide: -1 | 1
  ) {
    const descendants = children.get(parentId) ?? []

    descendants.forEach((childId, childIndex) => {
      const side = childIndex % 2 === 0 ? preferredSide : (preferredSide === 1 ? -1 : 1)
      const lane = Math.floor(childIndex / 2)
      const childX = parentX
      const childY = parentY + side * (calloutDistance + lane * calloutSpread)

      positions.set(childId, { x: childX, y: childY })

      const grandChildren = children.get(childId) ?? []
      grandChildren.forEach((grandChildId, grandChildIndex) => {
        positions.set(grandChildId, {
          x: childX + extensionGap + grandChildIndex * 180,
          y: childY,
        })
      })
    })
  }

  rootChildren.forEach((nodeId, index) => {
    const x = milestoneStartX + index * milestoneGap
    positions.set(nodeId, { x, y: baselineY })
    placeCallouts(nodeId, x, baselineY, index % 2 === 0 ? -1 : 1)
  })

  return positions
}

function layoutDoubleBubbleMap(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[]
) {
  const children = buildChildrenMap(edges)
  const positions = new Map<string, { x: number; y: number }>()
  const rootChildren = children.get("root") ?? []
  const center = { x: 420, y: 240 }
  const sideRadius = 260
  const sideGapY = 54
  const leafRadius = 290
  const leafGapY = 175
  const nodeHalfHeight = 56

  positions.set("root", center)

  function placeSide(nodeIdsForSide: string[], direction: -1 | 1) {
    const branchExtents = nodeIdsForSide.map((nodeId) => {
      const descendants = children.get(nodeId) ?? []
      const traitHalfExtent =
        descendants.length <= 1
          ? nodeHalfHeight
          : ((descendants.length - 1) * leafGapY) / 2 + nodeHalfHeight

      return Math.max(nodeHalfHeight, traitHalfExtent)
    })

    const totalHeight =
      branchExtents.reduce((sum, extent) => sum + extent * 2, 0) +
      Math.max(nodeIdsForSide.length - 1, 0) * sideGapY
    let currentY = center.y - totalHeight / 2

    nodeIdsForSide.forEach((nodeId, index) => {
      const extent = branchExtents[index]
      const y = currentY + extent
      const x = center.x + direction * sideRadius

      positions.set(nodeId, { x, y })

      const descendants = children.get(nodeId) ?? []
      descendants.forEach((childId, childIndex) => {
        positions.set(childId, {
          x: x + direction * leafRadius,
          y: y + (childIndex - (descendants.length - 1) / 2) * leafGapY,
        })
      })

      currentY += extent * 2 + sideGapY
    })
  }

  const half = Math.ceil(rootChildren.length / 2)
  placeSide(rootChildren.slice(0, half), -1)
  placeSide(rootChildren.slice(half), 1)

  return positions
}

function layoutFishboneMap(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[]
) {
  const children = buildChildrenMap(edges)
  const positions = new Map<string, { x: number; y: number }>()
  const rootChildren = children.get("root") ?? []
  const spineY = 220

  positions.set("root", { x: 180, y: spineY })

  rootChildren.forEach((nodeId, index) => {
    const x = 430 + index * 190
    const direction = index % 2 === 0 ? -1 : 1
    const y = spineY + direction * 120

    positions.set(nodeId, { x, y })

    const descendants = children.get(nodeId) ?? []
    descendants.forEach((childId, childIndex) => {
      positions.set(childId, {
        x: x + 150 + childIndex * 120,
        y: y + direction * (60 + childIndex * 28),
      })
    })
  })

  return positions
}

function layoutMatrixMap(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[]
) {
  const children = buildChildrenMap(edges)
  const positions = new Map<string, { x: number; y: number }>()
  const rootChildren = children.get("root") ?? []
  const quadrants = [
    { x: -220, y: -150 },
    { x: 220, y: -150 },
    { x: -220, y: 150 },
    { x: 220, y: 150 },
  ]

  positions.set("root", { x: 420, y: 220 })

  rootChildren.forEach((nodeId, index) => {
    const quadrant = quadrants[index % quadrants.length]
    positions.set(nodeId, {
      x: 420 + quadrant.x,
      y: 220 + quadrant.y,
    })

    const descendants = children.get(nodeId) ?? []
    descendants.forEach((childId, childIndex) => {
      const column = childIndex % 2
      const row = Math.floor(childIndex / 2)
      positions.set(childId, {
        x: 420 + quadrant.x + (column === 0 ? -120 : 120),
        y: 220 + quadrant.y + 110 + row * 100,
      })
    })
  })

  return positions
}

function layoutNodesForStyle(
  nodes: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[],
  style: MindmapStyle
) {
  if (style === "flowchart") {
    const flowPositions = layoutVerticalHierarchy(nodes, edges, {
      levelGap: 170,
      siblingGap: 260,
      offsetX: 160,
      offsetY: 100,
    })

    return nodes.map((node) => ({
      ...node,
      position: flowPositions.get(node.id) ?? node.position,
    }))
  }

  if (style === "tree-diagram") {
    const treePositions = layoutTreeDiagram(nodes, edges)

    return nodes.map((node) => ({
      ...node,
      position: treePositions.get(node.id) ?? node.position,
    }))
  }

  if (style === "concept-map") {
    const conceptPositions = layoutConceptMap(nodes, edges)

    return nodes.map((node) => ({
      ...node,
      position: conceptPositions.get(node.id) ?? node.position,
    }))
  }

  if (style === "org-chart") {
    const orgPositions = layoutVerticalHierarchy(nodes, edges, {
      levelGap: 160,
      siblingGap: 240,
      offsetX: 180,
      offsetY: 90,
    })

    return nodes.map((node) => ({
      ...node,
      position: orgPositions.get(node.id) ?? node.position,
    }))
  }

  if (style === "timeline-map") {
    const timelinePositions = layoutTimelineMap(nodes, edges)

    return nodes.map((node) => ({
      ...node,
      position: timelinePositions.get(node.id) ?? node.position,
    }))
  }

  // if (style === "double-bubble") {
  //   const doubleBubblePositions = layoutDoubleBubbleMap(nodes, edges)

  //   return nodes.map((node) => ({
  //     ...node,
  //     position: doubleBubblePositions.get(node.id) ?? node.position,
  //   }))
  // }

  // if (style === "fishbone") {
  //   const fishbonePositions = layoutFishboneMap(nodes, edges)

  //   return nodes.map((node) => ({
  //     ...node,
  //     position: fishbonePositions.get(node.id) ?? node.position,
  //   }))
  // }

  // if (style === "matrix") {
  //   const matrixPositions = layoutMatrixMap(nodes, edges)

  //   return nodes.map((node) => ({
  //     ...node,
  //     position: matrixPositions.get(node.id) ?? node.position,
  //   }))
  // }

  if (style === "bubble-map") {
    const bubblePositions = layoutBubbleMap(nodes, edges)

    return nodes.map((node) => ({
      ...node,
      position: bubblePositions.get(node.id) ?? node.position,
    }))
  }

  const children = buildChildrenMap(edges)
  const parentMap = buildParentMap(edges)
  const levels = getTreeLevels(nodes, edges)
  const order = new Map<string, number>()

  createSubtreeOrder("root", children, { value: 0 }, order)

  return nodes.map((node) => {
    if (node.id === "root") {
      return {
        ...node,
        position: { x: 320, y: 180 },
      }
    }

    const level = levels.get(node.id) ?? 1
    const parentId = parentMap.get(node.id) ?? "root"
    const siblings = children.get(parentId) ?? []
    const siblingIndex = Math.max(0, siblings.indexOf(node.id))

    switch (style) {
      case "timeline-map":
        return {
          ...node,
          position: {
            x: 320 + level * 220,
            y: siblingIndex % 2 === 0 ? 90 : 270,
          },
        }
      default: {
        const side = siblingIndex % 2 === 0 ? 1 : -1
        return {
          ...node,
          position: {
            x: 320 + side * (220 + Math.max(level - 1, 0) * 170),
            y: 180 + Math.floor(siblingIndex / 2) * 120 - 60,
          },
        }
      }
    }
  })
}

function getNodeSurfaceStyle(nodeId: string, style: MindmapStyle) {
  const isRoot = nodeId === "root"
  const isBubble = style === "bubble-map" //|| style === "double-bubble"
  const borderRadius = isBubble ? 9999 : style === "flowchart" ? 8 : 14
  const minWidth = isRoot && isBubble ? 132 : isBubble ? 152 : 176
  const minHeight = isRoot && isBubble ? 132 : isBubble ? 108 : 56
  const palette =
    style === "bubble-map"
      ? {
          rootBg: "#173f4f",
          nodeBg: "#1f3140",
          rootBorder: "#67e8f9",
          nodeBorder: "#7dd3fc",
        }
      : style === "flowchart"
        ? {
            rootBg: "#3b1f10",
            nodeBg: "#2a221a",
            rootBorder: "#fb923c",
            nodeBorder: "#fdba74",
          }
        : style === "tree-diagram" || style === "org-chart"
          ? {
              rootBg: "#1f3a22",
              nodeBg: "#1c2b1f",
              rootBorder: "#86efac",
              nodeBorder: "#4ade80",
            }
          : style === "timeline-map"
            ? {
                rootBg: "#1f2842",
                nodeBg: "#1f2433",
                rootBorder: "#a5b4fc",
                nodeBorder: "#818cf8",
              }
            // : style === "fishbone"
            //   ? {
            //       rootBg: "#3f2a14",
            //       nodeBg: "#2f2419",
            //       rootBorder: "#fcd34d",
            //       nodeBorder: "#fbbf24",
            //     }
            //   : style === "matrix"
            //     ? {
            //         rootBg: "#3a1d3f",
            //         nodeBg: "#2c2030",
            //         rootBorder: "#f0abfc",
            //         nodeBorder: "#d8b4fe",
            //       }
                : {
                    rootBg: "#0f2f3a",
                    nodeBg: "#182027",
                    rootBorder: "#38bdf8",
                    nodeBorder: "#94a3b8",
                  }

  return {
    minWidth: `${minWidth}px`,
    minHeight: `${minHeight}px`,
    padding: isBubble ? "20px" : "14px 16px",
    borderRadius: `${borderRadius}px`,
    border: isRoot
      ? `2px solid ${palette.rootBorder}`
      : `1px solid ${palette.nodeBorder}`,
    background: isRoot ? palette.rootBg : palette.nodeBg,
    color: "#f8fafc",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.28)",
    fontSize: "14px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
  }
}

function getEdgeDecoration(style: MindmapStyle) {
  const base = {
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: "color-mix(in oklab, var(--foreground) 45%, var(--border))",
    },
    style: {
      stroke: "color-mix(in oklab, var(--foreground) 45%, var(--border))",
      strokeWidth: 1.8,
    },
  }

  switch (style) {
    case "tree-diagram":
      return {
        ...base,
        type: "smoothstep" as const,
        pathOptions: { offset: 22, borderRadius: 12 },
      }
    case "concept-map":
      return {
        ...base,
        type: "smoothstep" as const,
        pathOptions: { offset: 26, borderRadius: 20 },
      }
    case "flowchart":
      return {
        ...base,
        type: "smoothstep" as const,
        pathOptions: { offset: 30, borderRadius: 12 },
      }
    case "org-chart":
      return {
        ...base,
        type: "smoothstep" as const,
        pathOptions: { offset: 22, borderRadius: 14 },
      }
    case "timeline-map":
      return {
        ...base,
        type: "smoothstep" as const,
        pathOptions: { offset: 18, borderRadius: 18 },
      }
    case "bubble-map":
      return {
        ...base,
        type: "default" as const,
        markerEnd: undefined,
        style: {
          stroke: "color-mix(in oklab, var(--foreground) 35%, var(--border))",
          strokeWidth: 1.6,
        },
      }
    // case "double-bubble":
    //   return {
    //     ...base,
    //     type: "double-bubble-edge" as const,
    //     markerEnd: undefined,
    //     style: {
    //       stroke: "color-mix(in oklab, var(--foreground) 35%, var(--border))",
    //       strokeWidth: 1.6,
    //     },
    //   }
    // case "fishbone":
    //   return {
    //     ...base,
    //     type: "smoothstep" as const,
    //     pathOptions: { offset: 16, borderRadius: 10 },
    //   }
    // case "matrix":
    //   return {
    //     ...base,
    //     type: "smoothstep" as const,
    //     pathOptions: { offset: 20, borderRadius: 18 },
    //   }
    default:
      return {
        ...base,
        type: getStylePreset(style).edgeType,
      }
  }
}

function getEdgeHandles(
  sourceNode: MindmapNodeRecord,
  targetNode: MindmapNodeRecord,
  style: MindmapStyle
): {
  sourceHandle: SourceHandleId
  targetHandle: TargetHandleId
} {
  const sourcePosition = sourceNode.position ?? { x: 0, y: 0 }
  const targetPosition = targetNode.position ?? { x: 0, y: 0 }
  const deltaX = targetPosition.x - sourcePosition.x
  const deltaY = targetPosition.y - sourcePosition.y

  if (style === "flowchart" || style === "org-chart") {
    return {
      sourceHandle: SOURCE_HANDLE_IDS.bottom,
      targetHandle: TARGET_HANDLE_IDS.top,
    }
  }

  if (style === "tree-diagram") {
    if (Math.abs(deltaY) < 56) {
      return {
        sourceHandle: SOURCE_HANDLE_IDS.right,
        targetHandle: TARGET_HANDLE_IDS.left,
      }
    }

    return {
      sourceHandle: deltaY < 0 ? SOURCE_HANDLE_IDS.top : SOURCE_HANDLE_IDS.bottom,
      targetHandle: TARGET_HANDLE_IDS.left,
    }
  }

  if (style === "timeline-map") {
    if (Math.abs(deltaY) > 80) {
      return {
        sourceHandle: deltaY < 0 ? SOURCE_HANDLE_IDS.top : SOURCE_HANDLE_IDS.bottom,
        targetHandle: deltaY < 0 ? TARGET_HANDLE_IDS.bottom : TARGET_HANDLE_IDS.top,
      }
    }

    return {
      sourceHandle: deltaX >= 0 ? SOURCE_HANDLE_IDS.right : SOURCE_HANDLE_IDS.left,
      targetHandle: deltaX >= 0 ? TARGET_HANDLE_IDS.left : TARGET_HANDLE_IDS.right,
    }
  }

  // if (style === "double-bubble") {
  //   if (Math.abs(deltaX) > Math.abs(deltaY)) {
  //     if (Math.abs(deltaY) < 40) {
  //       return {
  //         sourceHandle: deltaX >= 0 ? SOURCE_HANDLE_IDS.right : SOURCE_HANDLE_IDS.left,
  //         targetHandle: deltaX >= 0 ? TARGET_HANDLE_IDS.left : TARGET_HANDLE_IDS.right,
  //       }
  //     }

  //     return {
  //       sourceHandle: deltaY < 0 ? SOURCE_HANDLE_IDS.top : SOURCE_HANDLE_IDS.bottom,
  //       targetHandle: deltaY < 0 ? TARGET_HANDLE_IDS.top : TARGET_HANDLE_IDS.bottom,
  //     }
  //   }

  //   return {
  //     sourceHandle: deltaY >= 0 ? SOURCE_HANDLE_IDS.bottom : SOURCE_HANDLE_IDS.top,
  //     targetHandle: deltaY >= 0 ? TARGET_HANDLE_IDS.top : TARGET_HANDLE_IDS.bottom,
  //   }
  // }

  // if (style === "fishbone") {
  //   if (Math.abs(deltaX) >= Math.abs(deltaY)) {
  //     return {
  //       sourceHandle: SOURCE_HANDLE_IDS.right,
  //       targetHandle: TARGET_HANDLE_IDS.left,
  //     }
  //   }

  //   return {
  //     sourceHandle: deltaY >= 0 ? SOURCE_HANDLE_IDS.bottom : SOURCE_HANDLE_IDS.top,
  //     targetHandle: deltaY >= 0 ? TARGET_HANDLE_IDS.top : TARGET_HANDLE_IDS.bottom,
  //   }
  // }

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      sourceHandle: deltaX >= 0 ? SOURCE_HANDLE_IDS.right : SOURCE_HANDLE_IDS.left,
      targetHandle: deltaX >= 0 ? TARGET_HANDLE_IDS.left : TARGET_HANDLE_IDS.right,
    }
  }

  return {
    sourceHandle: deltaY >= 0 ? SOURCE_HANDLE_IDS.bottom : SOURCE_HANDLE_IDS.top,
    targetHandle: deltaY >= 0 ? TARGET_HANDLE_IDS.top : TARGET_HANDLE_IDS.bottom,
  }
}

function MindmapNode({
  id,
  data,
}: NodeProps<MindmapCanvasNode>) {
  return (
    <div
      className="relative"
      style={getNodeSurfaceStyle(id, data.style)}
    >
      <Handle
        id={SOURCE_HANDLE_IDS.top}
        type="source"
        position={Position.Top}
        style={{
          opacity: 0,
          width: 10,
          height: 10,
          background: "transparent",
          border: "none",
        }}
      />
      <Handle
        id={TARGET_HANDLE_IDS.top}
        type="target"
        position={Position.Top}
        style={{
          opacity: 0,
          width: 10,
          height: 10,
          background: "transparent",
          border: "none",
        }}
      />
      <Handle
        id={SOURCE_HANDLE_IDS.left}
        type="source"
        position={Position.Left}
        style={{
          opacity: 0,
          width: 10,
          height: 10,
          background: "transparent",
          border: "none",
        }}
      />
      <Handle
        id={SOURCE_HANDLE_IDS.right}
        type="source"
        position={Position.Right}
        style={{
          opacity: 0,
          width: 10,
          height: 10,
          background: "transparent",
          border: "none",
        }}
      />
      <Handle
        id={SOURCE_HANDLE_IDS.bottom}
        type="source"
        position={Position.Bottom}
        style={{
          opacity: 0,
          width: 10,
          height: 10,
          background: "transparent",
          border: "none",
        }}
      />
      <Handle
        id={TARGET_HANDLE_IDS.left}
        type="target"
        position={Position.Left}
        style={{
          opacity: 0,
          width: 10,
          height: 10,
          background: "transparent",
          border: "none",
        }}
      />
      <Handle
        id={TARGET_HANDLE_IDS.right}
        type="target"
        position={Position.Right}
        style={{
          opacity: 0,
          width: 10,
          height: 10,
          background: "transparent",
          border: "none",
        }}
      />
      <Handle
        id={TARGET_HANDLE_IDS.bottom}
        type="target"
        position={Position.Bottom}
        style={{
          opacity: 0,
          width: 10,
          height: 10,
          background: "transparent",
          border: "none",
        }}
      />
      <input
        value={data.label}
        className="nodrag w-full bg-transparent text-center outline-none"
        style={{ color: "#f8fafc" }}
        onChange={(event) => data.onLabelChange(id, event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      />
    </div>
  )
}

function DoubleBubbleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: EdgeProps<MindmapCanvasEdge>) {
  const deltaX = targetX - sourceX
  const deltaY = targetY - sourceY
  const direction = deltaX >= 0 ? 1 : -1

  if (Math.abs(deltaY) < 28) {
    return (
      <BaseEdge
        id={id}
        path={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`}
        markerEnd={markerEnd}
        style={style}
      />
    )
  }

  const verticalLaneOffset = Math.max(-44, Math.min(44, deltaY * 0.18))
  const laneX = sourceX + deltaX * 0.42 + verticalLaneOffset * direction
  const sourceStubX = sourceX + direction * 14
  const targetStubX = targetX - direction * 14
  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceStubX} ${sourceY}`,
    `L ${laneX} ${sourceY}`,
    `L ${laneX} ${targetY}`,
    `L ${targetStubX} ${targetY}`,
    `L ${targetX} ${targetY}`,
  ].join(" ")

  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
}

const nodeTypes = {
  mindmap: MindmapNode,
}

const edgeTypes = {
  "double-bubble-edge": DoubleBubbleEdge,
}

const noopLabelChange = () => {}

function decorateEdges(
  records: MindmapCanvasEdge[],
  nodes: MindmapNodeRecord[],
  style: MindmapStyle
): MindmapCanvasEdge[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const edgeDecoration = getEdgeDecoration(style)

  return records.map((record) => {
    const sourceNode = nodeMap.get(record.source)
    const targetNode = nodeMap.get(record.target)

    if (!sourceNode || !targetNode) {
      return {
        ...record,
        ...edgeDecoration,
        data: { style },
      }
    }

    const handles = getEdgeHandles(sourceNode, targetNode, style)

    return {
      ...record,
      ...edgeDecoration,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      data: { style },
    }
  })
}

function decorateNodes(
  records: MindmapNodeRecord[],
  edges: MindmapCanvasEdge[],
  style: MindmapStyle,
  onLabelChange: (id: string, label: string) => void
): MindmapCanvasNode[] {
  const parentMap = buildParentMap(edges)

  return records.map((record) => {
    const positions = getNodePositions(record, parentMap.get(record.id), style)

    return {
      id: record.id,
      type: "mindmap",
      position: record.position ?? { x: 0, y: 0 },
      draggable: false,
      sourcePosition: positions.sourcePosition,
      targetPosition: positions.targetPosition,
      data: {
        label: record.data.label,
        isRoot: record.id === "root",
        style,
        onLabelChange,
      },
    }
  })
}

function serializeNodes(nodes: MindmapCanvasNode[]): MindmapNodeRecord[] {
  return nodes.map((node) => ({
    id: node.id,
    data: {
      label: String(node.data?.label ?? "Untitled node"),
    },
  }))
}

function MindmapCanvas({
  value,
  onChange,
}: {
  value: MindmapContent
  onChange: (nextValue: MindmapContent) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const edgesRef = useRef<MindmapCanvasEdge[]>([])
  const [contextNodeId, setContextNodeId] = useState<string | null>(null)
  const [contextPosition, setContextPosition] = useState({ x: 0, y: 0 })
  const { fitView, setCenter } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const normalizedValue = useMemo(() => normalizeContent(value), [value])
  const initialEdges = useMemo(
    () =>
      decorateEdges(
        normalizedValue.edges as MindmapCanvasEdge[],
        normalizedValue.nodes,
        normalizedValue.content.style
      ),
    [normalizedValue.content.style, normalizedValue.edges, normalizedValue.nodes]
  )
  const initialNodes = useMemo(
    () =>
      decorateNodes(
        normalizedValue.nodes,
        initialEdges,
        normalizedValue.content.style,
        noopLabelChange
      ),
    [initialEdges, normalizedValue.content.style, normalizedValue.nodes]
  )

  const [nodes, setNodes, onNodesChange] =
    useNodesState<MindmapCanvasNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<MindmapCanvasEdge>(initialEdges)

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  const stylePreset = useMemo(
    () => getStylePreset(normalizedValue.content.style),
    [normalizedValue.content.style]
  )

  const emitChange = useCallback(
    (
      nextNodes: MindmapCanvasNode[],
      nextEdges: MindmapCanvasEdge[],
      nextStyle: MindmapStyle = normalizedValue.content.style
    ) => {
      onChange(
        mindmapRecordsToContent(
          nextStyle,
          serializeNodes(nextNodes),
          nextEdges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type,
          })),
          CURRENT_MINDMAP_LAYOUT_VERSION
        )
      )
    },
    [normalizedValue.content.style, onChange]
  )

  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      const nextLabel = label.slice(0, 160) || "Untitled node"
      let nextNodesSnapshot: MindmapCanvasNode[] = []

      setNodes((currentNodes) => {
        nextNodesSnapshot = currentNodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  label: nextLabel,
                },
              }
            : node
        )

        return nextNodesSnapshot
      })

      if (nextNodesSnapshot.length > 0) {
        emitChange(nextNodesSnapshot, edgesRef.current)
      }
    },
    [emitChange, setNodes]
  )

  useEffect(() => {
    const nextEdges = decorateEdges(
      normalizedValue.edges as MindmapCanvasEdge[],
      normalizedValue.nodes,
      normalizedValue.content.style
    )
    const nextNodes = decorateNodes(
      normalizedValue.nodes,
      nextEdges,
      normalizedValue.content.style,
      handleLabelChange
    )

    setNodes(nextNodes)
    setEdges(nextEdges)
  }, [
    handleLabelChange,
    normalizedValue.edges,
    normalizedValue.nodes,
    normalizedValue.content.style,
    setEdges,
    setNodes,
  ])

  useEffect(() => {
    nodes.forEach((node) => updateNodeInternals(node.id))
  }, [nodes, updateNodeInternals])

  useEffect(() => {
    if (nodes.length === 0) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (nodes.length === 1) {
        void setCenter(
          nodes[0].position.x,
          nodes[0].position.y,
          { zoom: 0.9, duration: 0 }
        )
        return
      }

      void fitView({
        nodes,
        padding: 0.7,
        minZoom: 0.25,
        maxZoom: 0.9,
        duration: 0,
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [fitView, nodes, setCenter])

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)
    },
    [onNodesChange]
  )

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes)

      const removedIds = new Set(
        changes.filter((change) => change.type === "remove").map((change) => change.id)
      )

      if (removedIds.size === 0) {
        return
      }

      emitChange(
        nodes,
        edges.filter((edge) => !removedIds.has(edge.id))
      )
    },
    [edges, emitChange, nodes, onEdgesChange]
  )

  const addChildNode = useCallback(() => {
    if (!contextNodeId) {
      return
    }

    const parent = nodes.find((node) => node.id === contextNodeId)

    if (!parent) {
      setContextNodeId(null)
      return
    }

    const newNode: MindmapNodeRecord = {
      id: `node-${Date.now()}`,
      data: {
        label: "New node",
      },
    }

    const nextEdgeRecords = [
      ...edges,
      {
        id: `edge-${parent.id}-${newNode.id}`,
        source: parent.id,
        target: newNode.id,
        type: stylePreset.edgeType,
      } satisfies MindmapCanvasEdge,
    ]
    const nextRecords = layoutNodesForStyle(
      [...serializeNodes(nodes), newNode],
      nextEdgeRecords,
      normalizedValue.content.style
    )
    const nextEdges = decorateEdges(
      nextEdgeRecords,
      nextRecords,
      normalizedValue.content.style
    )
    const nextNodes = decorateNodes(
      nextRecords,
      nextEdges,
      normalizedValue.content.style,
      handleLabelChange
    )

    setNodes(nextNodes)
    setEdges(nextEdges)
    emitChange(nextNodes, nextEdges)
    setContextNodeId(null)
  }, [
    contextNodeId,
    edges,
    emitChange,
    handleLabelChange,
    nodes,
    normalizedValue.content.style,
    setEdges,
    setNodes,
    stylePreset.edgeType,
  ])

  const deleteNode = useCallback(() => {
    if (!contextNodeId || contextNodeId === "root") {
      setContextNodeId(null)
      return
    }

    const branchIds = collectBranchIds(contextNodeId, edges)
    const nextEdgeRecords = edges.filter(
      (edge) => !branchIds.has(edge.source) && !branchIds.has(edge.target)
    )
    const nextRecords = layoutNodesForStyle(
      serializeNodes(nodes).filter((node) => !branchIds.has(node.id)),
      nextEdgeRecords,
      normalizedValue.content.style
    )
    const nextEdges = decorateEdges(
      nextEdgeRecords,
      nextRecords,
      normalizedValue.content.style
    )
    const nextNodes = decorateNodes(
      nextRecords,
      nextEdges,
      normalizedValue.content.style,
      handleLabelChange
    )

    setNodes(nextNodes)
    setEdges(nextEdges)
    emitChange(nextNodes, nextEdges)
    setContextNodeId(null)
  }, [
    contextNodeId,
    edges,
    emitChange,
    handleLabelChange,
    nodes,
    normalizedValue.content.style,
    setEdges,
    setNodes,
  ])

  const updateStyle = useCallback(
    (nextStyle: MindmapStyle) => {
      const nextEdgeRecords = edges.map((edge) => ({
        ...edge,
        type: getStylePreset(nextStyle).edgeType,
      }))
      const nextRecords = layoutNodesForStyle(
        serializeNodes(nodes),
        nextEdgeRecords,
        nextStyle
      )
      const nextEdges = decorateEdges(nextEdgeRecords, nextRecords, nextStyle)
      const nextNodes = decorateNodes(
        nextRecords,
        nextEdges,
        nextStyle,
        handleLabelChange
      )

      setNodes(nextNodes)
      setEdges(nextEdges)
      emitChange(nextNodes, nextEdges, nextStyle)
    },
    [edges, emitChange, handleLabelChange, nodes, setEdges, setNodes]
  )

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-hidden rounded-xl border border-border/70 bg-background"
      onClick={() => setContextNodeId(null)}
    >
      <ReactFlow
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.15}
        maxZoom={2.5}
        nodeOrigin={[0.5, 0.5]}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeContextMenu={(event, node) => {
          event.preventDefault()
          const bounds = containerRef.current?.getBoundingClientRect()
          setContextNodeId(node.id)
          setContextPosition({
            x: event.clientX - (bounds?.left ?? 0),
            y: event.clientY - (bounds?.top ?? 0),
          })
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitViewOptions={{ padding: 0.7 }}
        defaultEdgeOptions={{ type: stylePreset.edgeType }}
      >
        <Background
          color="color-mix(in oklab, var(--border) 80%, transparent)"
          variant={stylePreset.background}
          gap={20}
        />
        <Panel position="top-left">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Workflow />
                {mindmapStyleLabels[normalizedValue.content.style]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              {mindmapStyles.map((style) => (
                <DropdownMenuItem key={style} onClick={() => updateStyle(style)}>
                  {mindmapStyleLabels[style]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Panel>
      </ReactFlow>

      {contextNodeId ? (
        <Card
          className="absolute z-20 w-44 shadow-lg"
          style={{
            left: Math.min(contextPosition.x, 560),
            top: Math.min(contextPosition.y, 420),
          }}
        >
          <CardContent className="flex flex-col gap-2 p-2">
            <Button size="sm" variant="outline" onClick={addChildNode}>
              <Plus />
              Add child node
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={contextNodeId === "root"}
              onClick={deleteNode}
            >
              <Trash2 />
              Delete branch
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export function MindmapEditor(props: {
  value: MindmapContent
  onChange: (nextValue: MindmapContent) => void
}) {
  return (
    <ReactFlowProvider>
      <MindmapCanvas {...props} />
    </ReactFlowProvider>
  )
}
