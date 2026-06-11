"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RecoverNoteForm({ initialSlug }: { initialSlug: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [slug, setSlug] = useState(initialSlug)
  const [recoveryKey, setRecoveryKey] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!slug || !recoveryKey) {
      setError("Slug and recovery key are required.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation must match.")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          slug,
          recoveryKey,
          newPassword,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string; note?: { slug: string } }
        | null

      if (!response.ok || !result?.note) {
        setError(result?.error ?? "We couldn’t recover this note.")
        return
      }

      router.push(`/${result.note.slug}`)
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-lg bg-background/95">
      <CardHeader>
        <CardTitle className="text-3xl">Recover note access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recovery-key">Recovery key</Label>
            <Input
              id="recovery-key"
              value={recoveryKey}
              onChange={(event) => setRecoveryKey(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={
              isPending ||
              newPassword.length < 6 ||
              confirmPassword.length < 6
            }
          >
            {isPending ? "Recovering..." : "Set new password"}
          </Button>
        </form>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Recovery failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-sm text-muted-foreground">
          Enter the slug and the one-time recovery key that was emailed when
          the note was created.
        </p>
        <Button asChild variant="ghost">
          <Link href="/">Back home</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
