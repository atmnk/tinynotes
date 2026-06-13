import { createDecipheriv, scryptSync } from "node:crypto"
import postgres from "postgres"

function decryptString(password, payload) {
  const key = scryptSync(password, payload.salt, 32)
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "hex")
  )

  decipher.setAuthTag(Buffer.from(payload.tag, "hex"))

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8")
}

const [slug, password] = process.argv.slice(2)

if (!slug || !password) {
  console.error("Usage: node scripts/inspect-note.mjs <slug> <password>")
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false })

try {
  const rows = await sql`
    select slug, note_type, version, updated_at, title, content, note_key_password
    from notes
    where slug = ${slug}
    limit 1
  `

  const row = rows[0]

  if (!row) {
    console.log("NOT_FOUND")
    process.exit(0)
  }

  const noteKey = decryptString(password, JSON.parse(row.note_key_password))
  const title = decryptString(noteKey, JSON.parse(row.title))
  const contentPayload =
    typeof row.content === "string" ? JSON.parse(row.content) : row.content
  const content = JSON.parse(decryptString(noteKey, contentPayload))

  console.log(
    JSON.stringify(
      {
        slug: row.slug,
        noteType: row.note_type,
        version: row.version,
        updatedAt: row.updated_at,
        title,
        content,
      },
      null,
      2
    )
  )
} finally {
  await sql.end()
}
