"use client"

import { useMemo, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { MindmapEditor } from "@/app/[slug]/_components/mindmap-editor"
import { mymmMindmapFixture } from "@/lib/mindmap-fixtures"
import { mindmapStyles, type MindmapContent, type MindmapStyle } from "@/lib/note-content"

function isMindmapStyle(value: string | null): value is MindmapStyle {
  return value !== null && mindmapStyles.includes(value as MindmapStyle)
}

function MindmapFixtureCanvas({
  initialContent,
}: {
  initialContent: MindmapContent
}) {
  const [content, setContent] = useState<MindmapContent>(initialContent)

  return <MindmapEditor value={content} onChange={setContent} />
}

function MindmapFixturePageInner() {
  const searchParams = useSearchParams()
  const requestedStyle = searchParams.get("style")
  const style = isMindmapStyle(requestedStyle) ? requestedStyle : mymmMindmapFixture.style

  const initialContent = useMemo<MindmapContent>(
    () => ({
      ...mymmMindmapFixture,
      style,
      items: mymmMindmapFixture.items.map((item) => ({ ...item })),
    }),
    [style]
  )

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Mind Map Fixture
          </p>
          <h1 className="text-2xl font-semibold">{style}</h1>
          <p className="text-sm text-muted-foreground">
            Exact `/mymm` parent-child graph fixture rendered in the current map style.
          </p>
        </div>

        <div data-testid="mindmap-fixture" className="rounded-2xl border border-border/70 bg-card p-4">
          <MindmapFixtureCanvas key={style} initialContent={initialContent} />
        </div>
      </div>
    </main>
  )
}

export default function MindmapFixturePage() {
  return (
    <Suspense>
      <MindmapFixturePageInner />
    </Suspense>
  )
}
