 "use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, GitFork, Plus } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type AccessibleNoteLink = {
  slug: string
  title: string
  updatedAt: string
  noteType: "text" | "mindmap"
}

export function AccessibleNotesSidebar({
  currentSlug,
  notes,
}: {
  currentSlug?: string | null
  notes: AccessibleNoteLink[]
}) {
  const router = useRouter()

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="border-sidebar-border/80"
    >
      <SidebarHeader className="border-sidebar-border border-b p-0">
        <div className="relative flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Image
            src="/logo.svg"
            alt="TinyNotes"
            width={32}
            height={32}
            className="shrink-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
          />
          <p className="min-w-0 flex-1 truncate text-xs font-semibold tracking-[0.14em] text-sidebar-foreground/80 uppercase group-data-[collapsible=icon]:hidden">
            TinyNotes
          </p>
          <SidebarTrigger className="absolute -right-4 z-20 rounded-full border bg-background shadow-sm" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quick access</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="New or open note"
                  onClick={() => router.push("/")}
                >
                  <Plus />
                  <span>New or open note</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Your unlocked notes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {notes.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="No notes unlocked yet">
                    <FileText />
                    <span>No notes unlocked yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                notes.map((note) => (
                  <SidebarMenuItem key={note.slug}>
                    <SidebarMenuButton
                      asChild
                      isActive={note.slug === currentSlug}
                      tooltip={note.title}
                    >
                      <Link href={`/${note.slug}`}>
                        {note.noteType === "mindmap" ? <GitFork /> : <FileText />}
                        <span>{note.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
