import type { JSONContent } from "@tiptap/core"

export type RichTextContent = JSONContent

export const defaultNoteContent: RichTextContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
}
