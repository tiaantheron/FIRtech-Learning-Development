import { accounts, authenticate, GUEST, assertEdit, scopeData, type Account } from "./services/permissions"
import { ensureAccounts } from "./services/accounts-workbook"
import { readEditorSheet } from "./services/workbook-editor"
import { createContext, useContext, useMemo, useState, useRef, useEffect } from "react"
import { filterWorkbook, applyOverrides } from "@/lib/calculations/filter"
import type { ParseResult } from "@/lib/models/types"
import { parseWorkbook } from "@/lib/services/parse"
import { download } from "@/lib/services/export"
import { mutateWorkbook, undoWorkbook, type CellValue } from "@/lib/services/workbook-editor"
import { EMPTY_FILTERS, type Filters } from "@/lib/calculations/metrics"
import { assertWorkbookSaveable } from "@/lib/services/save-checks"
import { sourcePicker, excelTypes, rememberedSource, writeSource, type WorkbookHandle } from "@/lib/services/file-connection"

interface WorkbookContextValue {
  user: Account; signIn: (username: string, password: string) => Promise<void>; signOut: () => void
  result: ParseResult | null; buffer: ArrayBuffer | null; dirty: boolean; canUndo: boolean; loading: boolean; error: string | null; notice: string | null
  downloadPending: boolean; confirmDownload: () => void
  sourceRevision: number; connected: boolean; rememberedName: string | null
  filters: Filters; setFilters: (f: Filters) => void
  loadFromFile: (file: File) => Promise<void>; openSource: () => Promise<void>; reconnect: () => Promise<void>; forgetSource: () => Promise<void>
  exportWorkbook: () => Promise<void>; refresh: () => Promise<void>; clear: () => void; undo: () => Promise<void>
  editRecord: (sheet: string, row: number | null, values: Record<string, CellValue>, action: "save" | "delete") => Promise<void>
  editRecords: (edits: { sheet: string; row: number | null; values: Record<string, CellValue>; action: "save" | "delete" }[]) => Promise<void>
}
const WorkbookContext = createContext<WorkbookContextValue | null>(null)
export function WorkbookProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Account>(GUEST)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [downloaded, setDownloaded] = useState<ArrayBuffer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sourceRevision, setSourceRevision] = useState(0)
  const [connected, setConnected] = useState(false)
  const [rememberedName, setRememberedName] = useState<string | null>(null)
  const history = useRef<ArrayBuffer[]>([])
  const handle = useRef<WorkbookHandle | null>(null)
  const remembered = useRef<WorkbookHandle | null>(null)
  const saved = useRef<ArrayBuffer | null>(null)
  const busy = useRef(false)
  const interacted = useRef(false)
  const user = useMemo(() => buffer && session.Username ? accounts(buffer).find(a => a.Username === session.Username && a.Active && a.PasswordHash === session.PasswordHash) ?? GUEST : GUEST, [buffer, session])
  const requireAdmin = () => { if (user.Role !== "Administrator") throw new Error("Administrator permission is required.") }
  async function signIn(username: string, password: string) {
    if (!buffer || busy.current) throw new Error("Wait for the workbook to finish loading.")
    const account = await authenticate(buffer, username, password)
    setSession(account); setFilters(EMPTY_FILTERS); history.current = []
  }
  function signOut() { if (busy.current) return; setSession(GUEST); setFilters(EMPTY_FILTERS); history.current = [] }
  const message = (e: unknown) => e instanceof Error ? e.message : "File operation failed. Your pending edits remain in this tab."
  async function run(action: () => Promise<void>) {
    if (busy.current) return
    busy.current = true; setLoading(true); setError(null)
    try { await action() }
    catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setError(message(e)) }
    finally { busy.current = false; setLoading(false) }
  }
  function canReplace() { return !busy.current && (!dirty || window.confirm("Discard unsaved edits and reload or replace this workbook?")) }
  async function install(file: File, connection: WorkbookHandle | null) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Please select an .xlsx workbook.")
    const original = await file.arrayBuffer()
    const bytes = await ensureAccounts(original)
    const parsed = parseWorkbook(bytes, file.name)
    if (!parsed.data) throw new Error("Workbook does not match the supported format: " + parsed.issues.filter(i => i.severity === "error").slice(0, 5).map(i => `${i.worksheet}: ${i.field ?? ""} ${i.message}`).join("; "))
    setResult(parsed); setBuffer(bytes); saved.current = original; handle.current = connection
    setSourceRevision(revision => revision + 1)
    history.current = []; setConnected(!!connection); setDirty(bytes !== original); setFilters(EMPTY_FILTERS); setNotice(null); setSession(GUEST); setDownloaded(null)
  }
  async function remember(connection: WorkbookHandle | null) {
    remembered.current = connection; setRememberedName(connection?.name ?? null)
    try { await rememberedSource(connection) }
    catch { setNotice("This browser could not remember the file connection. Choose the file again next visit.") }
  }
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch("/firtech_dashboard.xlsx", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load the default Excel workbook. Replace the workbook to continue.")
      const bytes = await response.arrayBuffer()
      if (!cancelled && !interacted.current) await install(new File([bytes], "firtech_dashboard.xlsx"), null)
    }).catch(e => { if (!cancelled && !interacted.current) setError(message(e)) })
      .finally(() => { if (!cancelled && !interacted.current) setLoading(false) })
    rememberedSource().then(connection => {
      if (!cancelled && !interacted.current && connection) { remembered.current = connection; setRememberedName(connection.name) }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = "" } }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [dirty])
  async function loadFromFile(file: File) {
    if (buffer) requireAdmin()
    interacted.current = true
    if (!canReplace()) return
    await run(async () => { await install(file, null); await remember(null) })
  }
  async function openSource() {
    if (buffer) requireAdmin()
    interacted.current = true
    if (!canReplace()) return
    await run(async () => {
      const picker = sourcePicker()
      if (!picker) throw new Error("Use the file upload control in this browser.")
      const [connection] = await picker.call(window, { multiple: false, types: excelTypes })
      if (await connection.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("Write access was not granted. Choose the file again and allow editing to enable automatic saves.")
      await install(await connection.getFile(), connection); await remember(connection)
    })
  }
  async function reconnect() {
    requireAdmin()
    interacted.current = true
    if (!canReplace() || !remembered.current) return
    await run(async () => {
      const connection = remembered.current!
      if (await connection.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("Allow file access to reconnect your workbook.")
      await install(await connection.getFile(), connection)
    })
  }
  async function forgetSource() {
    requireAdmin()
    if (busy.current) return
    interacted.current = true; handle.current = null; setConnected(false)
    setNotice("File connection forgotten. Use Download Excel to keep any further edits.")
    await remember(null)
  }
  async function persist(next: ArrayBuffer, parsed: ParseResult) {
    if (!handle.current || !saved.current) { setNotice("Changes are in this tab. Download Excel to keep them."); return }
    try {
      assertWorkbookSaveable(parsed)
      await writeSource(handle.current, saved.current, next)
      saved.current = next; setDirty(false); setNotice(`Saved automatically to ${parsed.fileName} at ${new Date().toLocaleTimeString()}.`)
    } catch (e) { setNotice(null); setError(`Not saved: ${message(e)}`) }
  }
  async function editRecord(sheet: string, row: number | null, values: Record<string, CellValue>, action: "save" | "delete") {
    if (!buffer || !result || busy.current) throw new Error("Workbook is busy. Please try again.")
    assertEdit(user, result.data!, sheet, row ? readEditorSheet(buffer, sheet).rows.find(r => r.row === row)?.values : undefined, values, action)
    busy.current = true; setLoading(true); setError(null)
    try {
      const next = await mutateWorkbook(buffer, sheet, row, values, action, user.Username === "admin" ? "System administrator" : user.Username)
      const parsed = parseWorkbook(next, result.fileName)
      history.current = [...history.current.slice(-19), buffer]
      setBuffer(next); setResult(parsed); setDirty(true)
      await persist(next, parsed)
    } finally { busy.current = false; setLoading(false) }
  }
  async function editRecords(edits: { sheet: string; row: number | null; values: Record<string, CellValue>; action: "save" | "delete" }[]) {
    if (!buffer || !result || busy.current) throw new Error("Workbook is busy. Please try again.")
    for (const edit of edits) assertEdit(user, result.data!, edit.sheet, edit.row ? readEditorSheet(buffer, edit.sheet).rows.find(r => r.row === edit.row)?.values : undefined, edit.values, edit.action)
    busy.current = true; setLoading(true); setError(null)
    try {
      let next = buffer
      const actor = user.Username === "admin" ? "System administrator" : user.Username
      for (const edit of edits) next = await mutateWorkbook(next, edit.sheet, edit.row, edit.values, edit.action, actor)
      const parsed = parseWorkbook(next, result.fileName)
      history.current = [...history.current.slice(-19), buffer]
      setBuffer(next); setResult(parsed); setDirty(true)
      await persist(next, parsed)
    } finally { busy.current = false; setLoading(false) }
  }
  async function undo() {
    requireAdmin()
    if (!result || !buffer || !history.current.length) return
    await run(async () => {
      const previous = await undoWorkbook(history.current[history.current.length - 1], buffer!, user.Username === "admin" ? "System administrator" : user.Username)
      history.current.pop()
      const parsed = parseWorkbook(previous, result.fileName)
      setBuffer(previous); setResult(parsed); setDirty(true); await persist(previous, parsed)
    })
  }
  async function exportWorkbook() {
    requireAdmin()
    if (!buffer || !result) return
    await run(async () => {
      assertWorkbookSaveable(result)
      if (handle.current) {
        if (await handle.current.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("File access was denied. Your edits remain unsaved.")
        await persist(buffer, result)
      } else {
        download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), result.fileName.replace(/\.xlsx$/i, "-updated.xlsx"))
        setDownloaded(buffer); setNotice("Download requested. Check that the file was saved before confirming below. Your edits remain in this tab.")
      }
    })
  }
  function confirmDownload() {
    if (busy.current) return
    requireAdmin()
    if (!downloaded || downloaded !== buffer) { setError("The workbook changed after the download request. Download the latest version before confirming."); return }
    saved.current = buffer; setDirty(false); setDownloaded(null); setNotice("Download confirmed by you. Keep that file to reload these records and their audit history.")
  }
  async function refresh() {
    if (handle.current) {
      if (!canReplace()) return
      await run(async () => { await install(await handle.current!.getFile(), handle.current) })
    } else if (buffer && result) setResult(parseWorkbook(buffer, result.fileName))
  }
  function clear() {
    requireAdmin()
    if (!canReplace()) return
    handle.current = null; saved.current = null; history.current = []
    setConnected(false); setBuffer(null); setResult(null); setError(null); setNotice(null); setDirty(false); setFilters(EMPTY_FILTERS)
  }
  return <WorkbookContext.Provider value={{ downloadPending: !!downloaded, confirmDownload, user, signIn, signOut, result, buffer, dirty, canUndo: history.current.length > 0, loading, error, notice, sourceRevision, connected, rememberedName, filters, setFilters, loadFromFile, openSource, reconnect, forgetSource, exportWorkbook, refresh, clear, editRecord, editRecords, undo }}>{children}</WorkbookContext.Provider>
}
export function useWorkbook() {
  const ctx = useContext(WorkbookContext)
  if (!ctx) throw new Error("useWorkbook must be used within WorkbookProvider")
  return ctx
}
export function useWorkbookData(filtered = true) {
  const { result, filters, user } = useWorkbook()
  return useMemo(() => { if (!result?.data) return null; const data = scopeData(applyOverrides(result.data), user); return filtered ? filterWorkbook(data, filters) : data }, [result, filters, filtered, user])
}
