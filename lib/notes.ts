import type { RichTextContent } from "@/lib/note-content"
import { ensureSchema, getDb } from "@/lib/db"
import { createRandomSecret, decryptString, encryptString } from "@/lib/encryption"
import type { NoteAccessEntry } from "@/lib/note-auth-session"
import { hashPassword, verifyPassword } from "@/lib/password"
import { normalizeRecoveryEmail } from "@/lib/recovery"

type NoteRow = {
  slug: string
  title: unknown
  password_hash: string
  content: unknown
  version: number
  note_key_password: string | null
  note_key_recovery: string | null
  recovery_email: string | null
  recovery_title: unknown
  recovery_content: unknown
  recovery_token_hash: string | null
  recovery_token_expires_at: string | null
  created_at: string
  updated_at: string
}

export type NoteRecord = {
  slug: string
  title: string
  content: RichTextContent
  version: number
  createdAt: string
  updatedAt: string
}

export type RecoveryKeyRotationRollback = {
  slug: string
  recoveryEmail: string | null
  wrappedRecoveryKey: string | null
}

function toNoteRecord(
  row: Pick<NoteRow, "slug" | "version" | "created_at" | "updated_at">,
  title: string,
  content: RichTextContent
) {
  return {
    slug: row.slug,
    title,
    content,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function getNoteRow(slug: string) {
  await ensureSchema()
  const sql = getDb()

  const rows = await sql<NoteRow[]>`
    SELECT
      slug,
      title,
      password_hash,
      content,
      version,
      note_key_password,
      note_key_recovery,
      recovery_email,
      recovery_title,
      recovery_content,
      recovery_token_hash,
      recovery_token_expires_at,
      created_at,
      updated_at
    FROM notes
    WHERE slug = ${slug}
    LIMIT 1
  `

  return rows[0] ?? null
}

function createInitialContent(): RichTextContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  }
}

function deriveFallbackTitle(slug: string) {
  const title = slug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

  return title || "Untitled note"
}

function parseContent(value: unknown): RichTextContent {
  if (!value) {
    return createInitialContent()
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as RichTextContent
    } catch {
      return createInitialContent()
    }
  }

  if (typeof value === "object" && "type" in (value as Record<string, unknown>)) {
    return value as RichTextContent
  }

  return createInitialContent()
}

function decryptNoteWithNoteKey(noteKey: string, row: Pick<NoteRow, "title" | "content">) {
  const encryptedTitle =
    typeof row.title === "string" ? JSON.parse(row.title) : row.title
  const title = decryptString(noteKey, encryptedTitle as Parameters<typeof decryptString>[1])
  const contentCipher =
    typeof row.content === "string" ? JSON.parse(row.content) : row.content
  const content = JSON.parse(
    decryptString(noteKey, contentCipher as Parameters<typeof decryptString>[1])
  ) as RichTextContent

  return { title, content }
}

function encryptNoteWithNoteKey(noteKey: string, title: string, content: RichTextContent) {
  return {
    title: JSON.stringify(encryptString(noteKey, title)),
    content: encryptString(noteKey, JSON.stringify(content)),
  }
}

function wrapNoteKeyWithPassword(password: string, noteKey: string) {
  return JSON.stringify(encryptString(password, noteKey))
}

function unwrapNoteKeyWithPassword(password: string, wrapped: string) {
  return decryptString(password, JSON.parse(wrapped))
}

function wrapNoteKeyWithRecoveryKey(recoveryKey: string, noteKey: string) {
  return JSON.stringify(encryptString(recoveryKey, noteKey))
}

function unwrapNoteKeyWithRecoveryKey(recoveryKey: string, wrapped: string) {
  return decryptString(recoveryKey, JSON.parse(wrapped))
}

async function migrateLegacyPasswordBasedNote(row: NoteRow, password: string) {
  const sql = getDb()
  const legacyTitle =
    typeof row.title === "string" && row.title
      ? (() => {
          try {
            return decryptString(password, JSON.parse(row.title))
          } catch {
            return row.title
          }
        })()
      : deriveFallbackTitle(row.slug)

  const legacyContent = (() => {
    try {
      const decrypted = decryptString(
        password,
        (typeof row.content === "string"
          ? JSON.parse(row.content)
          : row.content) as Parameters<typeof decryptString>[1]
      )
      return JSON.parse(decrypted) as RichTextContent
    } catch {
      return parseContent(row.content)
    }
  })()

  const noteKey = createRandomSecret()
  const encrypted = encryptNoteWithNoteKey(noteKey, legacyTitle, legacyContent)

  await sql`
    UPDATE notes
    SET
      title = ${encrypted.title},
      content = ${sql.json(encrypted.content)},
      note_key_password = ${wrapNoteKeyWithPassword(password, noteKey)},
      note_key_recovery = NULL,
      recovery_email = NULL,
      recovery_title = NULL,
      recovery_content = NULL,
      recovery_token_hash = NULL,
      recovery_token_expires_at = NULL,
      updated_at = NOW()
    WHERE slug = ${row.slug}
  `

  return {
    noteKey,
    title: legacyTitle,
    content: legacyContent,
  }
}

async function unlockRowWithPassword(row: NoteRow, password: string) {
  if (!verifyPassword(password, row.password_hash)) {
    return { status: "forbidden" as const, note: null, noteKey: null }
  }

  if (!row.note_key_password) {
    const migrated = await migrateLegacyPasswordBasedNote(row, password)
    return {
      status: "ok" as const,
      note: toNoteRecord(row, migrated.title, migrated.content),
      noteKey: migrated.noteKey,
    }
  }

  const noteKey = unwrapNoteKeyWithPassword(password, row.note_key_password)
  const decrypted = decryptNoteWithNoteKey(noteKey, row)

  return {
    status: "ok" as const,
    note: toNoteRecord(row, decrypted.title, decrypted.content),
    noteKey,
  }
}

export async function getNoteShell(slug: string) {
  await ensureSchema()
  const sql = getDb()

  const rows = await sql<Pick<NoteRow, "slug" | "version" | "updated_at">[]>`
    SELECT slug, version, updated_at
    FROM notes
    WHERE slug = ${slug}
    LIMIT 1
  `

  return rows[0] ?? null
}

export async function createOrOpenNote(
  slug: string,
  password: string,
  recoveryEmail?: string
) {
  const existingNote = await getNoteRow(slug)

  if (!existingNote) {
    const sql = getDb()
    const title = deriveFallbackTitle(slug)
    const content = createInitialContent()
    const noteKey = createRandomSecret()
    const encrypted = encryptNoteWithNoteKey(noteKey, title, content)
    const recoveryKey = recoveryEmail ? createRandomSecret(24) : null

    const inserted = await sql<NoteRow[]>`
      INSERT INTO notes (
        slug,
        title,
        password_hash,
        content,
        version,
        note_key_password,
        note_key_recovery
      )
      VALUES (
        ${slug},
        ${encrypted.title},
        ${hashPassword(password)},
        ${sql.json(encrypted.content)},
        0,
        ${wrapNoteKeyWithPassword(password, noteKey)},
        ${recoveryKey ? wrapNoteKeyWithRecoveryKey(recoveryKey, noteKey) : null}
      )
      RETURNING
        slug,
        title,
        password_hash,
        content,
        version,
        note_key_password,
        note_key_recovery,
        recovery_email,
        recovery_title,
        recovery_content,
        recovery_token_hash,
        recovery_token_expires_at,
        created_at,
        updated_at
    `

    return {
      status: "created" as const,
      note: toNoteRecord(inserted[0], title, content),
      recoveryKey,
    }
  }

  const unlocked = await unlockRowWithPassword(existingNote, password)

  if (unlocked.status !== "ok") {
    return {
      status: "forbidden" as const,
      note: null,
      recoveryKey: null,
    }
  }

  return {
    status: "opened" as const,
    note: unlocked.note,
    recoveryKey: null,
  }
}

export async function unlockNote(slug: string, password: string) {
  const row = await getNoteRow(slug)

  if (!row) {
    return {
      status: "missing" as const,
      note: null,
    }
  }

  const unlocked = await unlockRowWithPassword(row, password)

  if (unlocked.status !== "ok") {
    return {
      status: "forbidden" as const,
      note: null,
    }
  }

  return {
    status: "ok" as const,
    note: unlocked.note,
  }
}

export async function saveNote(
  slug: string,
  password: string,
  title: string,
  content: RichTextContent,
  expectedVersion?: number
) {
  const row = await getNoteRow(slug)

  if (!row) {
    return {
      status: "missing" as const,
      note: null,
    }
  }

  const unlocked = await unlockRowWithPassword(row, password)

  if (unlocked.status !== "ok") {
    return {
      status: "forbidden" as const,
      note: null,
    }
  }

  const sql = getDb()
  const encrypted = encryptNoteWithNoteKey(unlocked.noteKey!, title, content)

  const rows = await sql<NoteRow[]>`
    UPDATE notes
    SET
      title = ${encrypted.title},
      content = ${sql.json(encrypted.content)},
      version = version + 1,
      updated_at = NOW()
    WHERE
      slug = ${slug}
      ${expectedVersion !== undefined ? sql`AND version = ${expectedVersion}` : sql``}
    RETURNING
      slug,
      title,
      password_hash,
      content,
      version,
      note_key_password,
      note_key_recovery,
      recovery_email,
      recovery_title,
      recovery_content,
      recovery_token_hash,
      recovery_token_expires_at,
      created_at,
      updated_at
  `

  if (rows.length === 0) {
    const latestRow = await getNoteRow(slug)

    if (!latestRow) {
      return {
        status: "missing" as const,
        note: null,
      }
    }

    const latestUnlocked = await unlockRowWithPassword(latestRow, password)

    if (latestUnlocked.status !== "ok") {
      return {
        status: "forbidden" as const,
        note: null,
      }
    }

    return {
      status: "conflict" as const,
      note: latestUnlocked.note,
    }
  }

  return {
    status: "ok" as const,
    note: toNoteRecord(rows[0], title, content),
  }
}

export async function changeNotePassword(
  slug: string,
  password: string,
  newPassword: string
) {
  const row = await getNoteRow(slug)

  if (!row) {
    return {
      status: "missing" as const,
      note: null,
    }
  }

  const unlocked = await unlockRowWithPassword(row, password)

  if (unlocked.status !== "ok") {
    return {
      status: "forbidden" as const,
      note: null,
    }
  }

  const sql = getDb()

  await sql<NoteRow[]>`
    UPDATE notes
    SET
      password_hash = ${hashPassword(newPassword)},
      note_key_password = ${wrapNoteKeyWithPassword(newPassword, unlocked.noteKey!)},
      version = version + 1,
      updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING
      slug,
      title,
      password_hash,
      content,
      version,
      note_key_password,
      note_key_recovery,
      recovery_email,
      recovery_title,
      recovery_content,
      recovery_token_hash,
      recovery_token_expires_at,
      created_at,
      updated_at
  `

  return {
    status: "ok" as const,
    note: unlocked.note,
  }
}

export async function recoverNoteWithRecoveryKey(
  slug: string,
  recoveryKey: string,
  newPassword: string
) {
  const row = await getNoteRow(slug)

  if (!row || !row.note_key_recovery) {
    return {
      status: "invalid" as const,
      note: null,
    }
  }

  let noteKey: string

  try {
    noteKey = unwrapNoteKeyWithRecoveryKey(recoveryKey, row.note_key_recovery)
  } catch {
    return {
      status: "invalid" as const,
      note: null,
    }
  }

  const decrypted = decryptNoteWithNoteKey(noteKey, row)
  const sql = getDb()

  const rows = await sql<NoteRow[]>`
    UPDATE notes
    SET
      password_hash = ${hashPassword(newPassword)},
      note_key_password = ${wrapNoteKeyWithPassword(newPassword, noteKey)},
      version = version + 1,
      updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING
      slug,
      title,
      password_hash,
      content,
      version,
      note_key_password,
      note_key_recovery,
      recovery_email,
      recovery_title,
      recovery_content,
      recovery_token_hash,
      recovery_token_expires_at,
      created_at,
      updated_at
  `

  return {
    status: "ok" as const,
    note: toNoteRecord(rows[0], decrypted.title, decrypted.content),
  }
}

export async function rotateRecoveryKey(
  slug: string,
  password: string,
  recoveryEmail?: string
) {
  const row = await getNoteRow(slug)

  if (!row) {
    return {
      status: "missing" as const,
      recoveryKey: null,
      recoveryEmail: null,
      rollback: null,
    }
  }

  const unlocked = await unlockRowWithPassword(row, password)

  if (unlocked.status !== "ok") {
    return {
      status: "forbidden" as const,
      recoveryKey: null,
      recoveryEmail: null,
      rollback: null,
    }
  }

  const nextRecoveryEmail = recoveryEmail
    ? normalizeRecoveryEmail(recoveryEmail)
    : row.recovery_email

  if (!nextRecoveryEmail) {
    return {
      status: "requires_email" as const,
      recoveryKey: null,
      recoveryEmail: null,
      rollback: null,
    }
  }

  const recoveryKey = createRandomSecret(24)
  const wrappedRecoveryKey = wrapNoteKeyWithRecoveryKey(recoveryKey, unlocked.noteKey!)
  const sql = getDb()

  await sql`
    UPDATE notes
    SET
      recovery_email = ${nextRecoveryEmail},
      note_key_recovery = ${wrappedRecoveryKey}
    WHERE slug = ${slug}
  `

  return {
    status: "ok" as const,
    recoveryKey,
    recoveryEmail: nextRecoveryEmail,
    rollback: {
      slug,
      recoveryEmail: row.recovery_email,
      wrappedRecoveryKey: row.note_key_recovery,
    } satisfies RecoveryKeyRotationRollback,
  }
}

export async function rollbackRecoveryKeyRotation(
  rollback: RecoveryKeyRotationRollback
) {
  await ensureSchema()
  const sql = getDb()

  await sql`
    UPDATE notes
    SET
      recovery_email = ${rollback.recoveryEmail},
      note_key_recovery = ${rollback.wrappedRecoveryKey}
    WHERE slug = ${rollback.slug}
  `
}

export async function deleteNoteBySlug(slug: string) {
  await ensureSchema()
  const sql = getDb()
  await sql`DELETE FROM notes WHERE slug = ${slug}`
}

export async function listAccessibleNotes(sessionNotes: NoteAccessEntry[]) {
  const results = await Promise.all(
    sessionNotes.map(async (sessionNote) => {
      const unlocked = await unlockNote(sessionNote.slug, sessionNote.password)

      if (unlocked.status !== "ok") {
        return null
      }

      return {
        slug: unlocked.note.slug,
        title: unlocked.note.title,
        updatedAt: unlocked.note.updatedAt,
      }
    })
  )

  return results.filter((note) => note !== null)
}
