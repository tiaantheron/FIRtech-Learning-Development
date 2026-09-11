import { createContext, useContext, useMemo, useState, useRef, useEffect } from "react"
import { filterWorkbook, applyOverrides } from "@/lib/calculations/filter"
import type { ParseResult } from "@/lib/models/types"
import { parseWorkbook } from "@/lib/services/parse"
import { download } from "@/lib/services/export"
import { mutateWorkbook, type CellValue } from "@/lib/services/workbook-editor"
import { EMPTY_FILTERS, type Filters } from "@/lib/calculations/metrics"
import { assertWorkbookSaveable } from "@/lib/services/save-checks"
import { sourcePicker, excelTypes, rememberedSource, writeSource, type WorkbookHandle } from "@/lib/services/file-connection"

interface WorkbookContextValue {
  result: ParseResult | null; buffer: ArrayBuffer | null; dirty: boolean; canUndo: boolean; loading: boolean; error: string | null; notice: string | null
  sourceRevision: number; connected: boolean; rememberedName: string | null
  filters: Filters; setFilters: (f: Filters) => void
  loadFromFile: (file: File) => Promise<void>; openSource: () => Promise<void>; reconnect: () => Promise<void>; forgetSource: () => Promise<void>
  exportWorkbook: () => Promise<void>; refresh: () => Promise<void>; clear: () => void; undo: () => Promise<void>
  editRecord: (sheet: string, row: number | null, values: Record<string, CellValue>, action: "save" | "delete") => Promise<void>
}
const WorkbookContext = createContext<WorkbookContextValue | null>(null)
export function WorkbookProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<ParseResult | null>(null)
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)
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
    const bytes = await file.arrayBuffer()
    const parsed = parseWorkbook(bytes, file.name)
    if (!parsed.data) throw new Error("Workbook does not match the supported format: " + parsed.issues.filter(i => i.severity === "error").slice(0, 5).map(i => `${i.worksheet}: ${i.field ?? ""} ${i.message}`).join("; "))
    setResult(parsed); setBuffer(bytes); saved.current = bytes; handle.current = connection
    setSourceRevision(revision => revision + 1)
    history.current = []; setConnected(!!connection); setDirty(false); setFilters(EMPTY_FILTERS); setNotice(null)
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
    interacted.current = true
    if (!canReplace()) return
    await run(async () => { await install(file, null); await remember(null) })
  }
  async function openSource() {
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
    interacted.current = true
    if (!canReplace() || !remembered.current) return
    await run(async () => {
      const connection = remembered.current!
      if (await connection.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("Allow file access to reconnect your workbook.")
      await install(await connection.getFile(), connection)
    })
  }
  async function forgetSource() {
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
    busy.current = true; setLoading(true); setError(null)
    try {
      const next = await mutateWorkbook(buffer, sheet, row, values, action)
      const parsed = parseWorkbook(next, result.fileName)
      history.current = [...history.current.slice(-19), buffer]
      setBuffer(next); setResult(parsed); setDirty(true)
      await persist(next, parsed)
    } finally { busy.current = false; setLoading(false) }
  }
  async function undo() {
    if (!result || !history.current.length) return
    await run(async () => {
      const previous = history.current.pop()!
      const parsed = parseWorkbook(previous, result.fileName)
      setBuffer(previous); setResult(parsed); setDirty(true); await persist(previous, parsed)
    })
  }
  async function exportWorkbook() {
    if (!buffer || !result) return
    await run(async () => {
      assertWorkbookSaveable(result)
      if (handle.current) {
        if (await handle.current.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("File access was denied. Your edits remain unsaved.")
        await persist(buffer, result)
      } else {
        download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), result.fileName.replace(/\.xlsx$/i, "-updated.xlsx"))
        saved.current = buffer; setDirty(false); setNotice("Download started. Keep the downloaded workbook to retain your edits.")
      }
    })
  }
  async function refresh() {
    if (handle.current) {
      if (!canReplace()) return
      await run(async () => { await install(await handle.current!.getFile(), handle.current) })
    } else if (buffer && result) setResult(parseWorkbook(buffer, result.fileName))
  }
  function clear() {
    if (!canReplace()) return
    handle.current = null; saved.current = null; history.current = []
    setConnected(false); setBuffer(null); setResult(null); setError(null); setNotice(null); setDirty(false); setFilters(EMPTY_FILTERS)
  }
  return <WorkbookContext.Provider value={{ result, buffer, dirty, canUndo: history.current.length > 0, loading, error, notice, sourceRevision, connected, rememberedName, filters, setFilters, loadFromFile, openSource, reconnect, forgetSource, exportWorkbook, refresh, clear, editRecord, undo }}>{children}</WorkbookContext.Provider>
}
export function useWorkbook() {
  const ctx = useContext(WorkbookContext)
  if (!ctx) throw new Error("useWorkbook must be used within WorkbookProvider")
  return ctx
}
export function useWorkbookData(filtered = true) {
  const { result, filters } = useWorkbook()
  return useMemo(() => { if (!result?.data) return null; const data = applyOverrides(result.data); return filtered ? filterWorkbook(data, filters) : data }, [result, filters, filtered])
}

