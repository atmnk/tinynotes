"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import type { NoteType } from "@/lib/note-content"
import { useRecaptcha } from "@/hooks/use-recaptcha"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const EXAMPLE_SLUGS = ["brain-dump", "trip-plan", "founder-notes"]

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export function CreateOrOpenNoteForm({
  recoveryEnabled,
}: {
  recoveryEnabled: boolean
}) {
  const router = useRouter()
  const executeRecaptcha = useRecaptcha()
  const [isPending, startTransition] = useTransition()
  const [slug, setSlug] = useState("")
  const [password, setPassword] = useState("")
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [noteType, setNoteType] = useState<NoteType>("text")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewUrl = useMemo(() => {
    if (!slug) {
      return "/your-note"
    }

    return `/${slug}`
  }, [slug])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    startTransition(async () => {
      const recaptchaToken = await executeRecaptcha("create_or_open_note")
      const response = await fetch("/api/notes/access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(recaptchaToken ? { "x-recaptcha-token": recaptchaToken } : {}),
        },
        body: JSON.stringify({
          slug,
          password,
          noteType,
          recoveryEmail: recoveryEnabled ? recoveryEmail : "",
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string; status?: "created" | "opened"; slug?: string }
        | null

      if (!response.ok || !result?.slug || !result.status) {
        setError(result?.error ?? "We couldn’t open that note.")
        return
      }

      setMessage(
        result.status === "created"
          ? "New note created. Opening editor..."
          : "Note unlocked. Opening editor..."
      )
      router.push(`/${result.slug}`)
    })
  }

  return (
    <Card className="border-border/60 bg-background/94 shadow-xl backdrop-blur">
      <CardHeader className="space-y-4">
        <Badge variant="secondary" className="w-fit">
          Start a note
        </Badge>
        <CardTitle className="text-2xl">Create or unlock a note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Note type</Label>
            <Tabs
              value={noteType}
              onValueChange={(value) => setNoteType(value as NoteType)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="mindmap">Mind map</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              placeholder="ideas"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setSlug(normalizeSlug(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Public URL preview: <span className="font-mono">{previewUrl}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              placeholder="At least 6 characters"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {recoveryEnabled ? (
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Recovery email (Optional)</Label>
              <Input
                id="recovery-email"
                type="email"
                value={recoveryEmail}
                placeholder="you@example.com"
                onChange={(event) => setRecoveryEmail(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If added, a one-time recovery key is emailed immediately and can
                be used later to reset access.
              </p>
            </div>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isPending || !slug || password.length < 6}
          >
            {isPending ? "Opening..." : "Open TinyNotes"}
          </Button>
        </form>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Example slugs
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SLUGS.map((exampleSlug) => (
              <Button
                key={exampleSlug}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSlug(exampleSlug)}
              >
                {exampleSlug}
              </Button>
            ))}
          </div>
        </div>

        <p className="text-xs leading-6 text-muted-foreground">
          No signup required. Just remember the slug and password
          {recoveryEnabled ? ", plus any recovery key sent to your email." : "."}
        </p>
        <p className="text-xs text-muted-foreground">
          Need direct access later? Open any saved note URL from the address bar
          and enter its password again.
        </p>
        <p className="text-xs text-muted-foreground">
          Protected by reCAPTCHA —{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Privacy
          </a>{" "}
          &amp;{" "}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Terms
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
