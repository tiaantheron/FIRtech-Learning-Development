

import { useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"

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
  FileDown,
  RefreshCw,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkbook } from "@/lib/workbook-context"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils/format"
import { WorkbookEditor } from "./workbook-editor"
import { Personalization } from "./personalization"
import { sourcePicker } from "@/lib/services/file-connection"

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
  { href: "/audit", label: "Audit History", icon: FileText },
  { href: "/validation", label: "Validation Console", icon: ShieldAlert },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { result, loading, loadFromFile, refresh, exportWorkbook, error, dirty, undo, canUndo, notice, sourceRevision, connected, rememberedName, openSource, reconnect, forgetSource } = useWorkbook()
  const [importOpen, setImportOpen] = useState(false)

  const fileInput = useRef<HTMLInputElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const errorCount = result?.issues.filter((i) => i.severity === "error").length ?? 0

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { loadFromFile(file); setImportOpen(false) }
    e.target.value = ""
  }

  return (
    <div className="app-surface flex min-h-screen bg-background">
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={onFile}
        aria-hidden
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 py-5">
          <img src="/firtech-logo.jpg" alt="FIRtech" className="h-10 w-32 rounded object-cover" />
          <p className="mt-2 text-xs tracking-wide text-sidebar-foreground/70">Intelligent Automation Hub</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
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
        <Personalization />
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
            <Button variant="outline" size="sm" aria-label="Open or replace workbook" disabled={loading} onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{result ? "Replace workbook" : "Open Excel"}</span>
            </Button>
            <Button variant="outline" size="sm" aria-label={connected ? "Save Excel workbook" : "Download Excel workbook"} onClick={exportWorkbook} disabled={loading || !result}>
              <FileDown className="h-4 w-4" /><span className="hidden sm:inline">{connected ? "Save Excel" : "Download Excel"}</span>
            </Button>
            <Button variant="outline" size="sm" aria-label="Refresh workbook" onClick={() => refresh()} disabled={loading || !result}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6 lg:py-8">
          {(!result || importOpen) && <section className="mb-6 rounded-xl border border-border bg-card p-6 sm:p-10" aria-labelledby="open-workbook-title">
            <FileDown className="mb-4 h-9 w-9 text-primary" />
            <h1 id="open-workbook-title" className="text-2xl font-semibold">Open your Excel workbook</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">Choose an .xlsx file from any folder or accessible drive on your computer. Use the FIRtech reference layout or the detailed 14-sheet format.</p>
            <p className="my-5 text-sm text-muted-foreground">Reporting defaults to South African rand (ZAR). Original transaction currencies are retained.</p>
            <div className="flex flex-wrap items-center gap-4"><Button disabled={loading} onClick={() => { if (sourcePicker()) { void openSource(); setImportOpen(false) } else fileInput.current?.click() }}><Upload className="h-4 w-4" />Choose Excel file</Button><a href="/firtech_dashboard.xlsx" download className="text-sm font-medium underline">Download reference workbook</a>{result && <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>}</div>
            <p className="mt-5 text-sm text-muted-foreground">With direct file access, applied edits save automatically to the chosen source workbook. Your browser remembers the connection for next time. Otherwise, download your edited workbook. Reports exports filtered tables separately.</p>
          </section>}
          {!result && rememberedName && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"><span className="text-sm">Remembered: {rememberedName}</span><Button disabled={loading} onClick={reconnect}>Reconnect workbook</Button><Button variant="outline" disabled={loading} onClick={forgetSource}>Forget file</Button></div>}
          {result && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{loading ? "Updating workbook…" : dirty ? "Pending changes — save or download to retain them." : connected ? "Autosave on · source workbook is up to date" : "Download mode · source file is not connected"}</span>{connected && <Button variant="ghost" size="sm" disabled={loading} onClick={forgetSource}>Forget file</Button>}<Button variant="outline" size="sm" onClick={undo} disabled={!canUndo || loading}>Undo last change</Button></div>}
          {result && !["/audit", "/reports"].includes(pathname) && <WorkbookEditor key={`${pathname}:${sourceRevision}`} route={pathname} />}
          {errorCount > 0 && <div role="alert" className="mb-5 rounded-lg border border-destructive p-4 text-sm">Calculations paused: {errorCount} workbook errors. <Link className="underline font-semibold" to="/validation">Open validation report</Link> and correct the workbook before replacing it.</div>}
          {result?.data && result.issues.some(i => i.severity === "warning") && <p className="mb-4 rounded-lg border border-border bg-card p-3 text-sm">Workbook loaded with {result.issues.filter(i => i.severity === "warning").length} notes about its data. <Link to="/validation" className="font-medium underline">Review import notes</Link>{result.data.overview.find(s => s.key === "DataStatus") && <span className="ml-2">Source status: {result.data.overview.find(s => s.key === "DataStatus")?.value}</span>}</p>}
          {notice && <p role="status" className="mb-4 rounded border bg-card p-3 text-sm print:hidden">{notice}</p>}
          {error ? (
            <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {loading && !result ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading workbook…
            </div>
          ) : (
            result ? children : null
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
