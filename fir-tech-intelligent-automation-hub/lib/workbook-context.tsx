import { createContext, useCallback, useContext, useMemo, useState, useRef, useEffect } from "react"
import { filterWorkbook, applyOverrides } from "@/lib/calculations/filter"
import type { ParseResult } from "@/lib/models/types"
import { parseWorkbook } from "@/lib/services/parse"
import { download } from "@/lib/services/export"
import { mutateWorkbook, type CellValue } from "@/lib/services/workbook-editor"
import { EMPTY_FILTERS, type Filters } from "@/lib/calculations/metrics"
type SaveHandle = { createWritable: () => Promise<{ write: (data: ArrayBuffer) => Promise<void>; close: () => Promise<void> }> }
interface WorkbookContextValue {
  result: ParseResult | null; buffer: ArrayBuffer | null; dirty: boolean; canUndo: boolean; loading: boolean; error: string | null
  filters: Filters; setFilters: (f: Filters) => void
  loadFromFile: (file: File) => Promise<void>
  exportWorkbook: () => Promise<void>; refresh: () => Promise<void>; clear: () => void; undo: () => void
  editRecord: (sheet: string, row: number | null, values: Record<string, CellValue>, action: "save" | "delete") => Promise<void>
}
const WorkbookContext = createContext<WorkbookContextValue | null>(null)
export function WorkbookProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<ParseResult | null>(null)
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const history = useRef<ArrayBuffer[]>([])
  const handle = useRef<SaveHandle | null>(null)
  const saved = useRef<ArrayBuffer | null>(null)
  const busy = useRef(false)
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = "" } }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [dirty])
  const loadFromFile = useCallback(async (file: File) => {
    if (busy.current || (dirty && !window.confirm("Replace this workbook and discard unsaved edits?"))) return
    busy.current = true; setLoading(true); setError(null)
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Please select an .xlsx workbook.")
      const bytes = await file.arrayBuffer()
      setResult(parseWorkbook(bytes, file.name)); setBuffer(bytes); saved.current = bytes
      history.current = []; handle.current = null; setDirty(false); setFilters(EMPTY_FILTERS)
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to read file") }
    finally { setLoading(false); busy.current = false }
  }, [dirty])
  const refresh = useCallback(async () => { if (buffer && result) setResult(parseWorkbook(buffer, result.fileName)) }, [buffer, result])
  const editRecord = useCallback(async (sheet: string, row: number | null, values: Record<string, CellValue>, action: "save" | "delete") => {
    if (!buffer || !result || busy.current) throw new Error("Workbook is busy. Please try again.")
    busy.current = true; setLoading(true)
    try {
      const next = await mutateWorkbook(buffer, sheet, row, values, action)
      history.current.push(buffer); setBuffer(next); setDirty(true); setResult(parseWorkbook(next, result.fileName)); setError(null)
    } finally { setLoading(false); busy.current = false }
  }, [buffer, result])
  const undo = useCallback(() => {
    if (busy.current) return
    const previous = history.current.pop()
    if (previous && result) { setBuffer(previous); setResult(parseWorkbook(previous, result.fileName)); setDirty(previous !== saved.current) }
  }, [result])
  const exportWorkbook = useCallback(async () => {
    if (!buffer || !result || busy.current) return
    busy.current = true; setLoading(true); setError(null)
    try {
      const picker = (window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<SaveHandle> }).showSaveFilePicker
      if (picker) {
        handle.current ??= await picker.call(window, { suggestedName: result.fileName, types: [{ description: "Excel workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }] })
        const writable = await handle.current.createWritable(); await writable.write(buffer); await writable.close()
      } else download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), result.fileName.replace(/\.xlsx$/i, "-updated.xlsx"))
      saved.current = buffer; setDirty(false)
    } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Save failed") }
    finally { setLoading(false); busy.current = false }
  }, [buffer, result])
  const clear = useCallback(() => { if (dirty && !window.confirm("Discard unsaved changes?")) return; setBuffer(null); setResult(null); setError(null); setDirty(false); history.current = []; setFilters(EMPTY_FILTERS) }, [dirty])
  const value = useMemo(() => ({ result, buffer, dirty, canUndo: history.current.length > 0, loading, error, filters, setFilters, loadFromFile, exportWorkbook, refresh, clear, editRecord, undo }), [result, buffer, dirty, loading, error, filters, loadFromFile, exportWorkbook, refresh, clear, editRecord, undo])
  return <WorkbookContext.Provider value={value}>{children}</WorkbookContext.Provider>
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
