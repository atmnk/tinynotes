import type { JSONContent } from "@tiptap/core"

export type RichTextContent = JSONContent

export const noteTypes = ["text", "mindmap"] as const
export type NoteType = (typeof noteTypes)[number]

export const mindmapStyles = [
  "concept-map",
  "flowchart",
  "bubble-map",
  "tree-diagram",
  "timeline-map",
  // "double-bubble",
  // "fishbone",
  "org-chart",
  // "matrix",
] as const

export type MindmapStyle = (typeof mindmapStyles)[number]

export type MindmapNodeRecord = {
  id: string
  position?: {
    x: number
    y: number
  }
  data: {
    label: string
  }
}

export type MindmapEdgeRecord = {
  id: string
  source: string
  target: string
  type?: string
}

export type MindmapItem = {
  id: string
  label: string
  parentId: string | null
}

export const CURRENT_MINDMAP_LAYOUT_VERSION = 2

export type MindmapContent = {
  style: MindmapStyle
  items: MindmapItem[]
  layoutVersion?: number
}

export const defaultRichTextContent: RichTextContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
}

export function createDefaultMindmapContent(
  style: MindmapStyle = "concept-map"
): MindmapContent {
  return {
    style,
    layoutVersion: CURRENT_MINDMAP_LAYOUT_VERSION,
    items: [
      {
        id: "root",
        label: "Central idea",
        parentId: null,
      },
    ],
  }
}

export function createDefaultNoteContent(noteType: NoteType = "text") {
  return noteType === "mindmap"
    ? createDefaultMindmapContent()
    : defaultRichTextContent
}

export function parseTextNoteContent(value: unknown): RichTextContent {
  if (!value) {
    return defaultRichTextContent
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as RichTextContent
    } catch {
      return defaultRichTextContent
    }
  }

  if (typeof value === "object" && "type" in (value as Record<string, unknown>)) {
    return value as RichTextContent
  }

  return defaultRichTextContent
}

export function parseMindmapContent(value: unknown): MindmapContent {
  if (!value) {
    return createDefaultMindmapContent()
  }

  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown
          } catch {
            return null
          }
        })()
      : value

  if (!parsed || typeof parsed !== "object") {
    return createDefaultMindmapContent()
  }

  const record = parsed as Record<string, unknown>
  const style = mindmapStyles.includes(record.style as MindmapStyle)
    ? (record.style as MindmapStyle)
    : "concept-map"

  const items = Array.isArray(record.items)
    ? record.items
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null
          }

          const itemRecord = item as Record<string, unknown>

          if (
            typeof itemRecord.id !== "string" ||
            typeof itemRecord.label !== "string" ||
            !(typeof itemRecord.parentId === "string" || itemRecord.parentId === null)
          ) {
            return null
          }

          return {
            id: itemRecord.id,
            label: itemRecord.label,
            parentId: itemRecord.parentId,
          } satisfies MindmapItem
        })
        .filter((item): item is MindmapItem => item !== null)
    : []

  const layoutVersion =
    typeof record.layoutVersion === "number" &&
    Number.isFinite(record.layoutVersion)
      ? record.layoutVersion
      : undefined

  if (items.length === 0) {
    return createDefaultMindmapContent(style)
  }

  return {
    style,
    items,
    layoutVersion,
  }
}

export function mindmapContentToRecords(content: MindmapContent): {
  nodes: MindmapNodeRecord[]
  edges: MindmapEdgeRecord[]
} {
  const nodes = content.items.map((item) => ({
    id: item.id,
    data: {
      label: item.label,
    },
  }))

  const edges = content.items
    .filter((item) => item.parentId)
    .map((item) => ({
      id: `edge-${item.parentId}-${item.id}`,
      source: item.parentId!,
      target: item.id,
    }))

  return { nodes, edges }
}

export function mindmapRecordsToContent(
  style: MindmapStyle,
  nodes: MindmapNodeRecord[],
  edges: MindmapEdgeRecord[],
  layoutVersion: number = CURRENT_MINDMAP_LAYOUT_VERSION
): MindmapContent {
  const parentById = new Map<string, string | null>()

  for (const edge of edges) {
    parentById.set(edge.target, edge.source)
  }

  return {
    style,
    layoutVersion,
    items: nodes.map((node) => ({
      id: node.id,
      label: node.data.label,
      parentId: parentById.get(node.id) ?? (node.id === "root" ? null : "root"),
    })),
  }
}
