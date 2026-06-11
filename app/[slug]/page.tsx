import { notFound } from "next/navigation"

import { AccessibleNotesSidebar } from "@/app/[slug]/_components/accessible-notes-sidebar"
import { NoteWorkspace } from "@/app/[slug]/_components/note-workspace"
import {
  getNotePasswordFromSession,
  readNoteAccessSession,
} from "@/lib/note-auth-session"
import { getNoteShell } from "@/lib/notes"
import { listAccessibleNotes, unlockNote } from "@/lib/notes"
import { slugSchema } from "@/lib/validation"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function NotePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const parsedSlug = slugSchema.safeParse(slug)

  if (!parsedSlug.success) {
    notFound()
  }

  const session = await readNoteAccessSession()
  const note = await getNoteShell(parsedSlug.data)
  const sessionPassword = getNotePasswordFromSession(session, parsedSlug.data)
  const initialUnlock =
    note && sessionPassword
      ? await unlockNote(parsedSlug.data, sessionPassword)
      : null
  const accessibleNotes = await listAccessibleNotes(session.notes)
  const fallbackTitle = parsedSlug.data
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

  return (
    <SidebarProvider defaultOpen>
      <AccessibleNotesSidebar
        currentSlug={parsedSlug.data}
        notes={accessibleNotes}
      />
      <SidebarInset>
        <main className="min-h-svh bg-[linear-gradient(180deg,oklch(0.985_0.01_95),oklch(0.965_0.005_220))] px-4 py-6 dark:bg-[linear-gradient(180deg,oklch(0.2_0.01_245),oklch(0.16_0.01_245))] md:px-6">
          <NoteWorkspace
            slug={parsedSlug.data}
            initialTitle={initialUnlock?.status === "ok" ? initialUnlock.note.title : fallbackTitle}
            updatedAt={
              initialUnlock?.status === "ok"
                ? initialUnlock.note.updatedAt
                : note?.updated_at ?? new Date().toISOString()
            }
            noteExists={Boolean(note)}
            initialNote={initialUnlock?.status === "ok" ? initialUnlock.note : null}
          />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
