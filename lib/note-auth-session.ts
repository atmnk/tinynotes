import "server-only"

import { createHash } from "node:crypto"
import { cookies } from "next/headers"
import { EncryptJWT, jwtDecrypt } from "jose"
import { z } from "zod"

const NOTE_AUTH_COOKIE = "notes_everywhere_auth"
const NOTE_AUTH_TTL_SECONDS = 60 * 60 * 24 * 30
const MAX_SESSION_NOTES = 20

const noteAccessEntrySchema = z.object({
  slug: z.string(),
  password: z.string(),
  grantedAt: z.string(),
})

const noteAccessSessionSchema = z.object({
  notes: z.array(noteAccessEntrySchema),
})

export type NoteAccessEntry = z.infer<typeof noteAccessEntrySchema>
export type NoteAccessSession = z.infer<typeof noteAccessSessionSchema>

function getSessionSecret() {
  const explicitSecret = process.env.AUTH_COOKIE_SECRET

  if (explicitSecret) {
    return explicitSecret
  }

  if (process.env.NODE_ENV !== "production") {
    return "notes-everywhere-dev-auth-secret-change-me"
  }

  throw new Error("AUTH_COOKIE_SECRET must be configured in production.")
}

function getSessionKey() {
  return createHash("sha256").update(getSessionSecret()).digest()
}

function normalizeSession(session: NoteAccessSession): NoteAccessSession {
  const deduped = new Map<string, NoteAccessEntry>()

  for (const note of session.notes) {
    deduped.set(note.slug, note)
  }

  return {
    notes: Array.from(deduped.values()).slice(-MAX_SESSION_NOTES).reverse(),
  }
}

async function encryptSession(session: NoteAccessSession) {
  return new EncryptJWT(noteAccessSessionSchema.parse(normalizeSession(session)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${NOTE_AUTH_TTL_SECONDS}s`)
    .encrypt(getSessionKey())
}

export async function readNoteAccessSession(): Promise<NoteAccessSession> {
  const cookieStore = await cookies()
  const token = cookieStore.get(NOTE_AUTH_COOKIE)?.value

  if (!token) {
    return { notes: [] }
  }

  try {
    const { payload } = await jwtDecrypt(token, getSessionKey())
    return noteAccessSessionSchema.parse(payload)
  } catch {
    return { notes: [] }
  }
}

export function getNotePasswordFromSession(
  session: NoteAccessSession,
  slug: string
) {
  return session.notes.find((note) => note.slug === slug)?.password ?? null
}

export async function attachNoteAccessCookie(
  response: Response & {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => void
    }
  },
  slug: string,
  password: string
) {
  const session = await readNoteAccessSession()
  const nextSession = normalizeSession({
    notes: [
      {
        slug,
        password,
        grantedAt: new Date().toISOString(),
      },
      ...session.notes.filter((note) => note.slug !== slug),
    ],
  })

  response.cookies.set(NOTE_AUTH_COOKIE, await encryptSession(nextSession), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: NOTE_AUTH_TTL_SECONDS,
    path: "/",
  })
}

export async function removeNoteAccessCookie(
  response: Response & {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => void
    }
  },
  slug: string
) {
  const session = await readNoteAccessSession()
  const nextSession = {
    notes: session.notes.filter((note) => note.slug !== slug),
  }

  if (nextSession.notes.length === 0) {
    response.cookies.set(NOTE_AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    })
    return
  }

  response.cookies.set(NOTE_AUTH_COOKIE, await encryptSession(nextSession), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: NOTE_AUTH_TTL_SECONDS,
    path: "/",
  })
}
