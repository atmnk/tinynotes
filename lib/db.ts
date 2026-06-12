import "server-only"

import postgres from "postgres"

declare global {
  var __notesEverywhereDb: ReturnType<typeof postgres> | undefined
  var __notesEverywhereSchemaPromise: Promise<void> | undefined
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured.")
  }

  return databaseUrl
}

export function getDb() {
  if (!globalThis.__notesEverywhereDb) {
    globalThis.__notesEverywhereDb = postgres(getDatabaseUrl(), {
      idle_timeout: 20,
      max: 1,
      onnotice: () => {},
      prepare: false,
    })
  }

  return globalThis.__notesEverywhereDb
}

export async function ensureSchema() {
  if (!globalThis.__notesEverywhereSchemaPromise) {
    const sql = getDb()

    globalThis.__notesEverywhereSchemaPromise = sql`
      CREATE TABLE IF NOT EXISTS notes (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Untitled note',
        password_hash TEXT NOT NULL,
        content JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        note_key_password TEXT,
        note_key_recovery TEXT,
        recovery_email TEXT,
        recovery_title TEXT,
        recovery_content JSONB,
        recovery_token_hash TEXT,
        recovery_token_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql`
          ALTER TABLE notes
          ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS note_key_password TEXT,
          ADD COLUMN IF NOT EXISTS note_key_recovery TEXT,
          ADD COLUMN IF NOT EXISTS recovery_email TEXT,
          ADD COLUMN IF NOT EXISTS recovery_title TEXT,
          ADD COLUMN IF NOT EXISTS recovery_content JSONB,
          ADD COLUMN IF NOT EXISTS recovery_token_hash TEXT,
          ADD COLUMN IF NOT EXISTS recovery_token_expires_at TIMESTAMPTZ
        `
      })
      .then(() => undefined)
  }

  return globalThis.__notesEverywhereSchemaPromise
}
