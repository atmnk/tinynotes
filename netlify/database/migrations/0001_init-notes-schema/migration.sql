CREATE TABLE IF NOT EXISTS notes (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled note',
  password_hash TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'text',
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
);

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note_key_password TEXT,
  ADD COLUMN IF NOT EXISTS note_key_recovery TEXT,
  ADD COLUMN IF NOT EXISTS recovery_email TEXT,
  ADD COLUMN IF NOT EXISTS recovery_title TEXT,
  ADD COLUMN IF NOT EXISTS recovery_content JSONB,
  ADD COLUMN IF NOT EXISTS recovery_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS recovery_token_expires_at TIMESTAMPTZ;
