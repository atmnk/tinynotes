import type { RichTextContent } from "@/lib/note-content"
import { defaultNoteContent } from "@/lib/note-content"
import {
  decryptString,
  encryptString,
  isEncryptedPayload,
  type EncryptedPayload,
} from "@/lib/encryption"

export type StoredNoteSecrets = {
  title: EncryptedPayload | string
  content: EncryptedPayload | RichTextContent | string | null
}

export function encryptNoteSecrets(
  password: string,
  title: string,
  content: RichTextContent
) {
  return {
    encryptedTitle: encryptString(password, title),
    encryptedContent: encryptString(password, JSON.stringify(content)),
  }
}

export function encryptRecoveryNoteSecrets(
  recoveryKey: string,
  title: string,
  content: RichTextContent
) {
  return {
    encryptedTitle: encryptString(recoveryKey, title),
    encryptedContent: encryptString(recoveryKey, JSON.stringify(content)),
  }
}

export function decryptNoteSecrets(
  password: string,
  stored: StoredNoteSecrets
): {
  title: string
  content: RichTextContent
  needsMigration: boolean
} {
  const titleResult = decryptTitle(password, stored.title)
  const contentResult = decryptContent(password, stored.content)

  return {
    title: titleResult.value,
    content: contentResult.value,
    needsMigration: titleResult.needsMigration || contentResult.needsMigration,
  }
}

export function decryptRecoveryNoteSecrets(
  recoveryKey: string,
  stored: StoredNoteSecrets
) {
  return {
    title: decryptTitle(recoveryKey, stored.title).value,
    content: decryptContent(recoveryKey, stored.content).value,
  }
}

function decryptTitle(password: string, value: StoredNoteSecrets["title"]) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown

      if (isEncryptedPayload(parsed)) {
        return {
          value: decryptString(password, parsed),
          needsMigration: false,
        }
      }
    } catch {
      // Keep falling through to legacy plaintext handling.
    }
  }

  if (isEncryptedPayload(value)) {
    return {
      value: decryptString(password, value),
      needsMigration: false,
    }
  }

  if (typeof value === "string" && value) {
    return {
      value,
      needsMigration: true,
    }
  }

  return {
    value: "Untitled note",
    needsMigration: true,
  }
}

function decryptContent(password: string, value: StoredNoteSecrets["content"]) {
  if (isEncryptedPayload(value)) {
    try {
      return {
        value: JSON.parse(decryptString(password, value)) as RichTextContent,
        needsMigration: false,
      }
    } catch {
      return {
        value: defaultNoteContent,
        needsMigration: false,
      }
    }
  }

  if (typeof value === "string") {
    try {
      return {
        value: JSON.parse(value) as RichTextContent,
        needsMigration: true,
      }
    } catch {
      return {
        value: defaultNoteContent,
        needsMigration: true,
      }
    }
  }

  if (value && typeof value === "object" && "type" in value) {
    return {
      value: value as RichTextContent,
      needsMigration: true,
    }
  }

  return {
    value: defaultNoteContent,
    needsMigration: true,
  }
}
