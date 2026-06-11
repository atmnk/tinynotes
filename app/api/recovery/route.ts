import { NextResponse } from "next/server"

import { attachNoteAccessCookie } from "@/lib/note-auth-session"
import { recoverNoteWithRecoveryKey } from "@/lib/notes"
import { resetRecoverySchema } from "@/lib/validation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = resetRecoverySchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid request.",
      },
      { status: 400 }
    )
  }

  const result = await recoverNoteWithRecoveryKey(
    parsed.data.slug,
    parsed.data.recoveryKey,
    parsed.data.newPassword
  )

  if (result.status !== "ok") {
    return NextResponse.json(
      { error: "That slug and recovery key combination is invalid." },
      { status: 400 }
    )
  }

  const response = NextResponse.json({
    note: result.note,
  })

  await attachNoteAccessCookie(response, result.note.slug, parsed.data.newPassword)

  return response
}
