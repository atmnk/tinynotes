import { z } from "zod"

import { recoveryEmailSchemaDescription } from "@/lib/recovery"

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug must be at least 1 character.")
  .max(48, "Slug must be 48 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens only."
  )

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters.")
  .max(128, "Password is too long.")

export const recoveryEmailSchema = z
  .string()
  .trim()
  .email(recoveryEmailSchemaDescription)

export const accessNoteSchema = z.object({
  slug: slugSchema,
  password: passwordSchema,
  recoveryEmail: recoveryEmailSchema.optional().or(z.literal("")),
})

export const unlockNoteSchema = z.object({
  password: passwordSchema,
})

export const saveNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(120, "Title must be 120 characters or fewer."),
  content: z.record(z.string(), z.unknown()),
})

export const changePasswordSchema = z.object({
  newPassword: passwordSchema,
})

export const resetRecoverySchema = z.object({
  slug: slugSchema,
  recoveryKey: z.string().trim().min(1, "Recovery key is required."),
  newPassword: passwordSchema,
})
