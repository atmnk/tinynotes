import { Sparkles } from "lucide-react"

import { CreateOrOpenNoteForm } from "@/app/_components/create-or-open-note-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const highlights = [
  "Tiny user-chosen slug URLs",
  "Password-protected anonymous access",
  "Rich text editor with autosave",
  "Neon free tier friendly backend",
]

export default function Page() {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,_oklch(0.98_0.02_220),_transparent_30%),linear-gradient(135deg,oklch(1_0_0),oklch(0.97_0.01_220))] px-4 py-10 md:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <Badge variant="outline" className="w-fit">
            Anonymous notes, instantly shareable
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
              Notes that live at a tiny URL you control.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Pick a slug, set a password, and start writing. If the slug is
              free, the note is created. If it already exists, the same slug
              plus password opens it.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {highlights.map((highlight) => (
              <Card key={highlight} className="border-border/70 bg-background/80">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="size-2 shrink-0 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{highlight}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="how-it-works" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="how-it-works">How it works</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="stack">Stack</TabsTrigger>
            </TabsList>
            <TabsContent value="how-it-works">
              <Card className="bg-background/85">
                <CardHeader>
                  <CardTitle>Simple flow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                  <p>1. Choose a short slug like `ideas-lab`.</p>
                  <p>2. Add a password to create or reopen that note.</p>
                  <p>3. Write in the editor and let autosave handle the rest.</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="privacy">
              <Alert>
                <Sparkles className="size-4" />
                <AlertTitle>Password-first access</AlertTitle>
                <AlertDescription>
                  Notes stay anonymous. Access is controlled only by the slug
                  and password pairing you choose.
                </AlertDescription>
              </Alert>
            </TabsContent>
            <TabsContent value="stack">
              <Card className="bg-background/85">
                <CardContent className="space-y-4 p-6 text-sm text-muted-foreground">
                  <p>Built with Next 16 App Router, shadcn/ui, TipTap, and Neon.</p>
                  <Separator />
                  <p>Ready for Netlify deployment with a single `DATABASE_URL`.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        <aside className="lg:pt-8">
          <CreateOrOpenNoteForm />
        </aside>
      </div>
    </main>
  )
}
