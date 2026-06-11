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
  Mail,
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
  version: number
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
  recoveryEnabled,
}: {
  slug: string
  initialTitle: string
  updatedAt: string
  noteExists: boolean
  initialNote: NotePayload | null
  recoveryEnabled: boolean
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
  const [lastSavedVersion, setLastSavedVersion] = useState(initialNote?.version ?? 0)
  const [lastSavedAt, setLastSavedAt] = useState(
    initialNote?.updatedAt ?? updatedAt
  )
  const [hasPendingLocalChanges, setHasPendingLocalChanges] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [nextPassword, setNextPassword] = useState("")
  const [confirmNextPassword, setConfirmNextPassword] = useState("")
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null)
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<string | null>(
    null
  )
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [recoveryKeyEmail, setRecoveryKeyEmail] = useState("")
  const [recoveryKeyError, setRecoveryKeyError] = useState<string | null>(null)
  const [recoveryKeyMessage, setRecoveryKeyMessage] = useState<string | null>(null)
  const [isEmailingRecoveryKey, setIsEmailingRecoveryKey] = useState(false)

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
    setLastSavedVersion(note.version)
    setLastSavedAt(note.updatedAt)
    setIsUnlocked(true)
    setDoesNoteExist(true)
    setAccessPassword("")
    setHasPendingLocalChanges(false)
    setSaveError(null)
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
          expectedVersion: lastSavedVersion,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string; note?: NotePayload }
        | null

      if (!response.ok || !result?.note) {
        if (response.status === 409 && result?.note) {
          applyUnlockedNote(result.note)
          setSyncMessage(
            "A newer version from another tab or device was loaded before this save completed."
          )
        }
        setSaveState("error")
        setSaveError(result?.error ?? "Autosave failed. Try again in a moment.")
        return
      }

      setLastSavedVersion(result.note.version)
      setLastSavedAt(result.note.updatedAt)
      setHasPendingLocalChanges(false)
      setSyncMessage(null)
      setSaveState("saved")
    },
    [applyUnlockedNote, lastSavedVersion, slug]
  )

  const scheduleSave = useCallback(
    (nextContent: RichTextContent, nextTitle: string) => {
      if (!isUnlocked) {
        return
      }

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }

      setHasPendingLocalChanges(true)
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
      setSyncMessage(null)
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
          recoveryEmail: recoveryEnabled ? recoveryEmail : "",
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
      setSyncMessage(null)
      router.refresh()
    },
    [applyUnlockedNote, recoveryEmail, recoveryEnabled, router, slug]
  )

  const refreshLatestNote = useCallback(async () => {
    if (!isUnlocked || hasPendingLocalChanges || saveState === "saving") {
      return
    }

    const response = await fetch(`/api/notes/${slug}`, {
      method: "GET",
      cache: "no-store",
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string; note?: NotePayload }
      | null

    if (!response.ok || !result?.note) {
      return
    }

    if (result.note.version !== lastSavedVersion) {
      applyUnlockedNote(result.note)
      setSaveState("saved")
      setSyncMessage("Latest changes from another tab or device were loaded.")
    }
  }, [
    applyUnlockedNote,
    hasPendingLocalChanges,
    isUnlocked,
    lastSavedVersion,
    saveState,
    slug,
  ])

  useEffect(() => {
    if (!editor || !isUnlocked) {
      return
    }

    editor.commands.setContent(noteContent, { emitUpdate: false })
    hydratedContentRef.current = true
  }, [editor, isUnlocked, noteContent])

  useEffect(() => {
    if (!isUnlocked) {
      return
    }

    function onFocus() {
      void refreshLatestNote()
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshLatestNote()
      }
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [isUnlocked, refreshLatestNote])

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
    setHasPendingLocalChanges(false)
    setSyncMessage(null)
    router.refresh()
  }

  async function handleRecoveryKeyRotation() {
    if (!recoveryEnabled) {
      return
    }

    setIsEmailingRecoveryKey(true)
    setRecoveryKeyError(null)
    setRecoveryKeyMessage(null)

    const response = await fetch(`/api/notes/${slug}/recovery-key`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recoveryEmail: recoveryKeyEmail,
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; recoveryEmail?: string }
      | null

    if (!response.ok || !result?.message || !result.recoveryEmail) {
      setIsEmailingRecoveryKey(false)
      setRecoveryKeyError(
        result?.error ?? "We couldn’t email a new recovery key right now."
      )
      return
    }

    setRecoveryKeyMessage(`${result.message} Sent to ${result.recoveryEmail}.`)
    setRecoveryKeyEmail("")
    setRecoveryKeyError(null)
    setIsEmailingRecoveryKey(false)
    setIsRecoveryDialogOpen(false)
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
    setSaveError(null)
    setSyncMessage(null)
    setHasPendingLocalChanges(false)
    setPasswordChangeMessage(null)
    setRecoveryKeyMessage(null)
    setRecoveryKeyError(null)
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
            {recoveryEnabled ? (
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
                  A recovery key will be emailed now. After you unlock the note
                  later, you can email a fresh recovery key if needed.
                </p>
              </div>
            ) : null}
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
            {recoveryEnabled ? (
              <Button asChild type="button" variant="outline">
                <Link href={`/recover?slug=${slug}`}>Recover with emailed key</Link>
              </Button>
            ) : null}
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
            {recoveryEnabled ? (
              <Dialog
                open={isRecoveryDialogOpen}
                onOpenChange={(open) => {
                  setIsRecoveryDialogOpen(open)
                  if (!open) {
                    setRecoveryKeyEmail("")
                    setRecoveryKeyError(null)
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Mail />
                    Email new recovery key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Email a new recovery key</DialogTitle>
                    <DialogDescription>
                      TinyNotes does not store your original recovery key, so it
                      cannot resend it. This will generate a new recovery key,
                      email it, and invalidate the previous one.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recovery-email-rotate">Recovery email</Label>
                      <Input
                        id="recovery-email-rotate"
                        type="email"
                        value={recoveryKeyEmail}
                        placeholder="Leave blank to reuse the current recovery email"
                        onChange={(event) => setRecoveryKeyEmail(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter a new email to replace the existing recovery email,
                        or leave this blank to reuse the current one.
                      </p>
                    </div>
                    {recoveryKeyError ? (
                      <Alert variant="destructive">
                        <AlertDescription>{recoveryKeyError}</AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsRecoveryDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isEmailingRecoveryKey}
                      onClick={() => void handleRecoveryKeyRotation()}
                    >
                      {isEmailingRecoveryKey ? "Emailing..." : "Email new key"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
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
          {recoveryEnabled && recoveryKeyMessage ? (
            <Alert>
              <AlertTitle>Recovery key rotated</AlertTitle>
              <AlertDescription>{recoveryKeyMessage}</AlertDescription>
            </Alert>
          ) : null}
          {syncMessage ? (
            <Alert>
              <AlertTitle>Synced latest copy</AlertTitle>
              <AlertDescription>{syncMessage}</AlertDescription>
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
