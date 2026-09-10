"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ParseResult } from "@/lib/models/types"
import { parseWorkbook } from "@/lib/services/parse"
import { EMPTY_FILTERS, type Filters } from "@/lib/calculations/metrics"

interface WorkbookContextValue {
  result: ParseResult | null
  loading: boolean
  error: string | null
  filters: Filters
  setFilters: (f: Filters) => void
  loadFromFile: (file: File) => Promise<void>
  loadSample: () => Promise<void>
  refresh: () => Promise<void>
  clear: () => void
}

const WorkbookContext = createContext<WorkbookContextValue | null>(null)

const SAMPLE_URL = "/sample-workbook.xlsx"

export function WorkbookProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<ParseResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [lastSource, setLastSource] = useState<"sample" | "file" | null>(null)

  const loadFromFile = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseWorkbook(buffer, file.name)
      setResult(parsed)
      setLastSource("file")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read file")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSample = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(SAMPLE_URL)
      if (!res.ok) throw new Error("Sample workbook not found")
      const buffer = await res.arrayBuffer()
      const parsed = parseWorkbook(buffer, "sample-workbook.xlsx")
      setResult(parsed)
      setLastSource("sample")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample workbook")
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (lastSource === "sample") await loadSample()
    else if (result) {
      // Re-run calculations on the currently loaded buffer is not stored; reloading sample is the safe default.
      setResult({ ...result, loadedAt: new Date().toISOString() })
    }
  }, [lastSource, loadSample, result])

  const clear = useCallback(() => {
    setResult(null)
    setLastSource(null)
  }, [])

  useEffect(() => {
    loadSample()
  }, [loadSample])

  const value = useMemo(
    () => ({ result, loading, error, filters, setFilters, loadFromFile, loadSample, refresh, clear }),
    [result, loading, error, filters, loadFromFile, loadSample, refresh, clear],
  )

  return <WorkbookContext.Provider value={value}>{children}</WorkbookContext.Provider>
}

export function useWorkbook() {
  const ctx = useContext(WorkbookContext)
  if (!ctx) throw new Error("useWorkbook must be used within WorkbookProvider")
  return ctx
}

export function useWorkbookData() {
  const { result } = useWorkbook()
  return result?.data ?? null
}
