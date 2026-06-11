import { NextResponse } from "next/server"

import { attachNoteAccessCookie } from "@/lib/note-auth-session"
import { isRecoveryFeatureEnabled } from "@/lib/features"
import { createOrOpenNote, deleteNoteBySlug } from "@/lib/notes"
import { sendRecoveryKeyEmail } from "@/lib/recovery"
import { accessNoteSchema } from "@/lib/validation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = accessNoteSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid request.",
      },
      { status: 400 }
    )
  }

  const { slug, password, recoveryEmail } = parsed.data
  const recoveryEnabled = isRecoveryFeatureEnabled()
  const result = await createOrOpenNote(
    slug,
    password,
    recoveryEnabled ? recoveryEmail || undefined : undefined
  )

  if (result.status === "forbidden") {
    return NextResponse.json(
      {
        error: "This slug already exists, and the password did not match.",
      },
      { status: 401 }
    )
  }

  if (
    recoveryEnabled &&
    result.status === "created" &&
    recoveryEmail &&
    result.recoveryKey
  ) {
    try {
      await sendRecoveryKeyEmail({
        recoveryEmail,
        recoveryKey: result.recoveryKey,
        slug,
      })
    } catch {
      await deleteNoteBySlug(slug)

      return NextResponse.json(
        {
          error:
            "We couldn't deliver the one-time recovery key email, so the note was not created.",
        },
        { status: 500 }
      )
    }
  }

  const response = NextResponse.json({
    status: result.status,
    slug: result.note.slug,
    title: result.note.title,
    note: result.note,
  })

  await attachNoteAccessCookie(response, slug, password)

  return response
}
