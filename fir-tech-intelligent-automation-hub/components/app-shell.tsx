"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  Target,
  Banknote,
  Handshake,
  Route,
  FileText,
  ShieldAlert,
  Upload,
  RefreshCw,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkbook } from "@/lib/workbook-context"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils/format"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/departments", label: "Departments", icon: Building2 },
  { href: "/people", label: "People", icon: Users },
  { href: "/training", label: "Training & Certs", icon: GraduationCap },
  { href: "/pipeline", label: "Leads & Opportunities", icon: Target },
  { href: "/revenue", label: "Revenue", icon: Banknote },
  { href: "/engagements", label: "Engagements", icon: Handshake },
  { href: "/pathways", label: "Partner Pathways", icon: Route },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/validation", label: "Validation Console", icon: ShieldAlert },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { result, loading, loadFromFile, loadSample, error } = useWorkbook()
  const fileInput = useRef<HTMLInputElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const errorCount = result?.issues.filter((i) => i.severity === "error").length ?? 0

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFromFile(file)
    e.target.value = ""
  }

  return (
    <div className="flex min-h-screen bg-background">
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onFile}
        aria-hidden
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            F
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">FIRtech</p>
            <p className="text-xs text-sidebar-foreground/60">Automation Hub</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.href === "/validation" && errorCount > 0 ? (
                  <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-white">
                    {errorCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3 text-xs text-sidebar-foreground/60">
          {result ? (
            <>
              <p className="truncate font-medium text-sidebar-foreground/80">{result.fileName}</p>
              <p>Loaded {formatDate(result.loadedAt.slice(0, 10))}</p>
            </>
          ) : (
            <p>No workbook loaded</p>
          )}
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:px-6">
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-muted-foreground">
              UiPath Partner Readiness · Resell Diamond &amp; Services Gold
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{result ? "Replace" : "Upload"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadSample()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6 lg:py-8">
          {error ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {loading && !result ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading workbook…
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed right-4 top-4 z-50 text-sidebar-foreground lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  )
}
