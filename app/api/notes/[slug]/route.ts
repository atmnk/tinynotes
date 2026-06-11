import { NextResponse } from "next/server"

import {
  attachNoteAccessCookie,
  getNotePasswordFromSession,
  readNoteAccessSession,
  removeNoteAccessCookie,
} from "@/lib/note-auth-session"
import { changeNotePassword, saveNote, unlockNote } from "@/lib/notes"
import type { RichTextContent } from "@/lib/note-content"
import {
  changePasswordSchema,
  saveNoteSchema,
  slugSchema,
  unlockNoteSchema,
} from "@/lib/validation"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const slugResult = slugSchema.safeParse(slug)

  if (!slugResult.success) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 })
  }

  const json = await request.json().catch(() => null)
  const parsed = unlockNoteSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid request.",
      },
      { status: 400 }
    )
  }

  const result = await unlockNote(slugResult.data, parsed.data.password)

  if (result.status === "missing") {
    return NextResponse.json({ error: "Note not found." }, { status: 404 })
  }

  if (result.status === "forbidden") {
    return NextResponse.json(
      { error: "That password did not match this note." },
      { status: 401 }
    )
  }

  const response = NextResponse.json({
    note: result.note,
  })

  await attachNoteAccessCookie(response, slugResult.data, parsed.data.password)

  return response
}

export async function PUT(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const slugResult = slugSchema.safeParse(slug)

  if (!slugResult.success) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 })
  }

  const json = await request.json().catch(() => null)
  const parsed = saveNoteSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid request.",
      },
      { status: 400 }
    )
  }

  const session = await readNoteAccessSession()
  const password = getNotePasswordFromSession(session, slugResult.data)

  if (!password) {
    return NextResponse.json(
      { error: "This note is not unlocked in your current session." },
      { status: 401 }
    )
  }

  const result = await saveNote(
    slugResult.data,
    password,
    parsed.data.title,
    parsed.data.content as RichTextContent
  )

  if (result.status === "missing") {
    return NextResponse.json({ error: "Note not found." }, { status: 404 })
  }

  if (result.status === "forbidden") {
    return NextResponse.json(
      { error: "That password did not match this note." },
      { status: 401 }
    )
  }

  return NextResponse.json({
    note: result.note,
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const slugResult = slugSchema.safeParse(slug)

  if (!slugResult.success) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 })
  }

  const json = await request.json().catch(() => null)
  const parsed = changePasswordSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid request.",
      },
      { status: 400 }
    )
  }

  const session = await readNoteAccessSession()
  const password = getNotePasswordFromSession(session, slugResult.data)

  if (!password) {
    return NextResponse.json(
      { error: "This note is not unlocked in your current session." },
      { status: 401 }
    )
  }

  const result = await changeNotePassword(
    slugResult.data,
    password,
    parsed.data.newPassword
  )

  if (result.status === "missing") {
    return NextResponse.json({ error: "Note not found." }, { status: 404 })
  }

  if (result.status === "forbidden") {
    return NextResponse.json(
      { error: "That current password did not match this note." },
      { status: 401 }
    )
  }

  const response = NextResponse.json({
    note: result.note,
  })

  await attachNoteAccessCookie(response, slugResult.data, parsed.data.newPassword)

  return response
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const slugResult = slugSchema.safeParse(slug)

  if (!slugResult.success) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  await removeNoteAccessCookie(response, slugResult.data)
  return response
}
