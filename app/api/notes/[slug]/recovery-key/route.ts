import { NextResponse } from "next/server"

import { isRecoveryFeatureEnabled } from "@/lib/features"
import {
  getNotePasswordFromSession,
  readNoteAccessSession,
} from "@/lib/note-auth-session"
import {
  rollbackRecoveryKeyRotation,
  rotateRecoveryKey,
} from "@/lib/notes"
import { sendRecoveryKeyEmail } from "@/lib/recovery"
import { rotateRecoveryKeySchema, slugSchema } from "@/lib/validation"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function POST(request: Request, context: RouteContext) {
  if (!isRecoveryFeatureEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const { slug } = await context.params
  const slugResult = slugSchema.safeParse(slug)

  if (!slugResult.success) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 })
  }

  const json = await request.json().catch(() => null)
  const parsed = rotateRecoveryKeySchema.safeParse(json)

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

  const result = await rotateRecoveryKey(
    slugResult.data,
    password,
    parsed.data.recoveryEmail || undefined
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

  if (result.status === "requires_email") {
    return NextResponse.json(
      {
        error:
          "Add a recovery email here before emailing a new recovery key.",
      },
      { status: 400 }
    )
  }

  try {
    await sendRecoveryKeyEmail({
      recoveryEmail: result.recoveryEmail,
      recoveryKey: result.recoveryKey,
      slug: slugResult.data,
    })
  } catch {
    await rollbackRecoveryKeyRotation(result.rollback)

    return NextResponse.json(
      {
        error:
          "We couldn't deliver the new recovery key email, so the previous recovery key stays active.",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    message:
      "A new recovery key was emailed. The previous recovery key no longer works.",
    recoveryEmail: result.recoveryEmail,
  })
}
