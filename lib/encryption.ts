import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"

const ENCRYPTION_KEY_LENGTH = 32
const IV_LENGTH = 12

export type EncryptedPayload = {
  version: 1
  salt: string
  iv: string
  tag: string
  ciphertext: string
}

export function createRandomSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex")
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") {
    return false
  }

  const payload = value as Record<string, unknown>

  return (
    payload.version === 1 &&
    typeof payload.salt === "string" &&
    typeof payload.iv === "string" &&
    typeof payload.tag === "string" &&
    typeof payload.ciphertext === "string"
  )
}

function deriveEncryptionKey(password: string, salt: string) {
  return scryptSync(password, salt, ENCRYPTION_KEY_LENGTH)
}

export function encryptString(password: string, value: string): EncryptedPayload {
  const salt = randomBytes(16).toString("hex")
  const iv = randomBytes(IV_LENGTH)
  const key = deriveEncryptionKey(password, salt)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    version: 1,
    salt,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
  }
}

export function decryptString(password: string, payload: EncryptedPayload) {
  const key = deriveEncryptionKey(password, payload.salt)
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "hex")
  )

  decipher.setAuthTag(Buffer.from(payload.tag, "hex"))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "hex")),
    decipher.final(),
  ])

  return plaintext.toString("utf8")
}
