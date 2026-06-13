import type { MindmapContent } from "@/lib/note-content"

export const mymmMindmapFixture: MindmapContent = {
  style: "bubble-map",
  layoutVersion: 2,
  items: [
    {
      id: "root",
      label: "Central idea",
      parentId: null,
    },
    {
      id: "node-1781342531383",
      label: "New node",
      parentId: "root",
    },
    {
      id: "node-1781342534253",
      label: "New node",
      parentId: "root",
    },
    {
      id: "node-1781342537703",
      label: "New node",
      parentId: "root",
    },
    {
      id: "node-1781342544311",
      label: "New node",
      parentId: "root",
    },
    {
      id: "node-1781342598711",
      label: "New node",
      parentId: "node-1781342531383",
    },
    {
      id: "node-1781342600778",
      label: "New node",
      parentId: "node-1781342531383",
    },
    {
      id: "node-1781342603053",
      label: "New node",
      parentId: "node-1781342534253",
    },
    {
      id: "node-1781342604719",
      label: "New node",
      parentId: "node-1781342534253",
    },
    {
      id: "node-1781343193920",
      label: "New node",
      parentId: "root",
    },
  ],
}
