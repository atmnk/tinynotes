"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import {
  ArrowLeft,
  Bold,
  Check,
  Copy,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  Quote,
  Save,
  Type,
} from "lucide-react"

import type { RichTextContent } from "@/lib/note-content"
import { defaultNoteContent } from "@/lib/note-content"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

type NotePayload = {
  slug: string
  title: string
  content: RichTextContent
  updatedAt: string
}

type SaveState = "idle" | "saving" | "saved" | "error"

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value))
}

export function NoteWorkspace({
  slug,
  initialTitle,
  updatedAt,
  noteExists,
  initialNote,
}: {
  slug: string
  initialTitle: string
  updatedAt: string
  noteExists: boolean
  initialNote: NotePayload | null
}) {
  const router = useRouter()
  const saveTimerRef = useRef<number | null>(null)
  const hydratedContentRef = useRef(Boolean(initialNote))
  const [accessPassword, setAccessPassword] = useState("")
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isUnlocked, setIsUnlocked] = useState(Boolean(initialNote))
  const [doesNoteExist, setDoesNoteExist] = useState(noteExists)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [title, setTitle] = useState(initialNote?.title ?? initialTitle)
  const [noteContent, setNoteContent] = useState<RichTextContent>(
    initialNote?.content ?? defaultNoteContent
  )
  const [saveState, setSaveState] = useState<SaveState>(
    initialNote ? "saved" : "idle"
  )
  const [lastSavedAt, setLastSavedAt] = useState(
    initialNote?.updatedAt ?? updatedAt
  )
  const [copied, setCopied] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [nextPassword, setNextPassword] = useState("")
  const [confirmNextPassword, setConfirmNextPassword] = useState("")
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null)
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<string | null>(
    null
  )
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start typing. Changes are saved automatically.",
      }),
    ],
    content: initialNote?.content ?? defaultNoteContent,
    editorProps: {
      attributes: {
        class: "tiptap focus-visible:ring-0",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      if (!hydratedContentRef.current) {
        return
      }

      scheduleSave(nextEditor.getJSON() as RichTextContent, title)
    },
  })

  const formattingState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isBold: currentEditor?.isActive("bold") ?? false,
      isItalic: currentEditor?.isActive("italic") ?? false,
      isHeading1: currentEditor?.isActive("heading", { level: 1 }) ?? false,
      isHeading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
      isBulletList: currentEditor?.isActive("bulletList") ?? false,
      isOrderedList: currentEditor?.isActive("orderedList") ?? false,
      isBlockquote: currentEditor?.isActive("blockquote") ?? false,
    }),
  })

  const toolbarState = formattingState ?? {
    isBold: false,
    isItalic: false,
    isHeading1: false,
    isHeading2: false,
    isBulletList: false,
    isOrderedList: false,
    isBlockquote: false,
  }

  const applyUnlockedNote = useCallback((note: NotePayload) => {
    setTitle(note.title)
    setNoteContent(note.content)
    setLastSavedAt(note.updatedAt)
    setIsUnlocked(true)
    setDoesNoteExist(true)
    setAccessPassword("")
    hydratedContentRef.current = false
  }, [])

  const persistNote = useCallback(
    async (nextTitle: string, nextContent: RichTextContent) => {
      setSaveState("saving")
      setSaveError(null)

      const response = await fetch(`/api/notes/${slug}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: nextTitle,
          content: nextContent,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string; note?: { updatedAt: string } }
        | null

      if (!response.ok || !result?.note) {
        setSaveState("error")
        setSaveError(result?.error ?? "Autosave failed. Try again in a moment.")
        return
      }

      setLastSavedAt(result.note.updatedAt)
      setSaveState("saved")
    },
    [slug]
  )

  const scheduleSave = useCallback(
    (nextContent: RichTextContent, nextTitle: string) => {
      if (!isUnlocked) {
        return
      }

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = window.setTimeout(() => {
        void persistNote(nextTitle, nextContent)
      }, 700)
    },
    [isUnlocked, persistNote]
  )

  const unlockNote = useCallback(
    async (password: string) => {
      setIsUnlocking(true)
      setUnlockError(null)

      const response = await fetch(`/api/notes/${slug}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string; note?: NotePayload }
        | null

      if (!response.ok || !result?.note) {
        setUnlockError(result?.error ?? "We couldn’t unlock this note.")
        setIsUnlocking(false)
        setIsUnlocked(false)
        return
      }

      applyUnlockedNote(result.note)
      setIsUnlocking(false)
      setSaveState("saved")
      setPasswordChangeMessage(null)
      router.refresh()
    },
    [applyUnlockedNote, router, slug]
  )

  const claimNote = useCallback(
    async (password: string) => {
      setIsUnlocking(true)
      setUnlockError(null)

      const response = await fetch("/api/notes/access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          slug,
          password,
          recoveryEmail,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
            slug?: string
            status?: "created" | "opened"
            note?: NotePayload
          }
        | null

      if (!response.ok || !result?.slug || !result.status || !result.note) {
        setUnlockError(result?.error ?? "We couldn’t claim that slug.")
        setIsUnlocking(false)
        return
      }

      applyUnlockedNote(result.note)
      setIsUnlocking(false)
      setSaveState("saved")
      setPasswordChangeMessage(null)
      router.refresh()
    },
    [applyUnlockedNote, recoveryEmail, router, slug]
  )

  useEffect(() => {
    if (!editor || !isUnlocked) {
      return
    }

    editor.commands.setContent(noteContent)
    hydratedContentRef.current = true
  }, [editor, isUnlocked, noteContent])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle)

    if (!editor || !isUnlocked) {
      return
    }

    scheduleSave(editor.getJSON() as RichTextContent, nextTitle)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function handlePasswordChange() {
    if (nextPassword.length < 6) {
      return
    }

    if (nextPassword !== confirmNextPassword) {
      setPasswordChangeError("New password and confirmation must match.")
      return
    }

    setIsChangingPassword(true)
    setPasswordChangeError(null)
    setPasswordChangeMessage(null)

    const response = await fetch(`/api/notes/${slug}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        newPassword: nextPassword,
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string; note?: NotePayload }
      | null

    if (!response.ok || !result?.note) {
      setIsChangingPassword(false)
      setPasswordChangeError(
        result?.error ?? "We couldn’t change the password right now."
      )
      return
    }

    applyUnlockedNote(result.note)
    setNextPassword("")
    setConfirmNextPassword("")
    setPasswordChangeMessage("Password updated. Auth cookie and note encryption were rotated.")
    setIsChangingPassword(false)
    setIsPasswordDialogOpen(false)
    router.refresh()
  }

  async function lockNote() {
    await fetch(`/api/notes/${slug}`, {
      method: "DELETE",
    })

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    setAccessPassword("")
    setIsUnlocked(false)
    setUnlockError(null)
    setSaveState("idle")
    setPasswordChangeMessage(null)
    hydratedContentRef.current = false
    router.refresh()
  }

  if (isUnlocking) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    )
  }

  if (isUnlocked && !editor) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    )
  }

  if (!doesNoteExist && !isUnlocked) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 pt-10">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">
            <ArrowLeft />
            Back home
          </Link>
        </Button>
        <Card className="bg-background/90">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              /{slug}
            </Badge>
            <CardTitle className="text-3xl">Claim this slug</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-7 text-muted-foreground">
              This slug is available. Set a password to create the note right
              here. Access will then be remembered in a secure cookie for this browser session.
            </p>
            <div className="space-y-2">
              <Label htmlFor="claim-password">Password</Label>
              <Input
                id="claim-password"
                type="password"
                value={accessPassword}
                placeholder="Choose a password for this slug"
                onChange={(event) => setAccessPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && accessPassword.length >= 6) {
                    event.preventDefault()
                    void claimNote(accessPassword)
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-recovery-email">Recovery email (Optional)</Label>
              <Input
                id="claim-recovery-email"
                type="email"
                value={recoveryEmail}
                placeholder="you@example.com"
                onChange={(event) => setRecoveryEmail(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A one-time recovery key will be emailed now. The app cannot
                resend or reconstruct that key later.
              </p>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={accessPassword.length < 6}
              onClick={() => void claimNote(accessPassword)}
            >
              Claim and open note
            </Button>
            {unlockError ? (
              <Alert variant="destructive">
                <AlertDescription>{unlockError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 pt-10">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">
            <ArrowLeft />
            Back home
          </Link>
        </Button>
        <Card className="bg-background/90">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              /{slug}
            </Badge>
            <CardTitle className="text-3xl">Unlock this note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="unlock-password">Password</Label>
              <Input
                id="unlock-password"
                type="password"
                value={accessPassword}
                placeholder="Enter the note password"
                onChange={(event) => setAccessPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && accessPassword.length >= 6) {
                    event.preventDefault()
                    void unlockNote(accessPassword)
                  }
                }}
              />
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={accessPassword.length < 6}
              onClick={() => void unlockNote(accessPassword)}
            >
              Open note
            </Button>
            <p className="text-sm leading-7 text-muted-foreground">
              This URL exists, but content stays hidden until the matching
              password is entered. Successful access is cached in a secure `httpOnly` cookie instead of local storage.
            </p>
            <Button asChild type="button" variant="outline">
              <Link href={`/recover?slug=${slug}`}>Recover with emailed key</Link>
            </Button>
            {unlockError ? (
              <Alert variant="destructive">
                <AlertDescription>{unlockError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeEditor = editor!

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Card className="border-border/70 bg-background/88 backdrop-blur">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SidebarTrigger variant="outline" size="icon-sm" />
              <Badge variant="outline">/{slug}</Badge>
              <Badge variant="secondary">
                {saveState === "saving"
                  ? "Saving..."
                  : saveState === "error"
                    ? "Save failed"
                    : "Autosave on"}
              </Badge>
              <Badge variant="outline">Encrypted</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Last saved {formatUpdatedAt(lastSavedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog
              open={isPasswordDialogOpen}
              onOpenChange={(open) => {
                setIsPasswordDialogOpen(open)
                if (!open) {
                  setNextPassword("")
                  setConfirmNextPassword("")
                  setPasswordChangeError(null)
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">Change password</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rotate note password</DialogTitle>
                  <DialogDescription>
                    Access for this note is stored in a secure `httpOnly`
                    cookie, and the note content is encrypted at rest with the
                    same password. Updating it will rotate both.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={nextPassword}
                      onChange={(event) => setNextPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm new password</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      value={confirmNextPassword}
                      onChange={(event) => setConfirmNextPassword(event.target.value)}
                    />
                  </div>
                  {passwordChangeError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{passwordChangeError}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsPasswordDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={
                      isChangingPassword ||
                      nextPassword.length < 6 ||
                      confirmNextPassword.length < 6
                    }
                    onClick={() => void handlePasswordChange()}
                  >
                    {isChangingPassword ? "Updating..." : "Update password"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => void copyLink()}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button variant="outline" onClick={() => void lockNote()}>
              Lock note
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">
                <ArrowLeft />
                Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/96 shadow-lg">
        <CardHeader className="gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {saveState === "saving" ? <LoaderCircle className="animate-spin" /> : <Save />}
              <span>
                {saveState === "saving"
                  ? "Saving changes"
                  : saveState === "error"
                    ? "Needs retry"
                    : "Changes save automatically"}
              </span>
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button
              variant={toolbarState.isBold ? "default" : "outline"}
              size="sm"
              onClick={() => activeEditor.chain().focus().toggleBold().run()}
            >
              <Bold />
              Bold
            </Button>
            <Button
              variant={toolbarState.isItalic ? "default" : "outline"}
              size="sm"
              onClick={() => activeEditor.chain().focus().toggleItalic().run()}
            >
              <Italic />
              Italic
            </Button>
            <Button
              variant={toolbarState.isHeading1 ? "default" : "outline"}
              size="sm"
              onClick={() => activeEditor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 />
              H1
            </Button>
            <Button
              variant={toolbarState.isHeading2 ? "default" : "outline"}
              size="sm"
              onClick={() => activeEditor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 />
              H2
            </Button>
            <Button
              variant={toolbarState.isBulletList ? "default" : "outline"}
              size="sm"
              onClick={() => activeEditor.chain().focus().toggleBulletList().run()}
            >
              <List />
              Bullets
            </Button>
            <Button
              variant={toolbarState.isOrderedList ? "default" : "outline"}
              size="sm"
              onClick={() => activeEditor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered />
              Numbers
            </Button>
            <Button
              variant={toolbarState.isBlockquote ? "default" : "outline"}
              size="sm"
              onClick={() => activeEditor.chain().focus().toggleBlockquote().run()}
            >
              <Quote />
              Quote
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeEditor.chain().focus().setParagraph().run()}
            >
              <Type />
              Paragraph
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <EditorContent editor={editor} />
          {passwordChangeMessage ? (
            <Alert>
              <AlertTitle>Password changed</AlertTitle>
              <AlertDescription>{passwordChangeMessage}</AlertDescription>
            </Alert>
          ) : null}
          {saveError ? (
            <Alert variant="destructive">
              <AlertTitle>Autosave needs attention</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
