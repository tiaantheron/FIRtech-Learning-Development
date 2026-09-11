

import { useEffect, useMemo, useState } from "react"
import { flushSync } from "react-dom"
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  align?: "left" | "right" | "center"
  render?: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
}

export function DataTable<T>({
  rows,
  columns,
  searchable = true,
  searchKeys,
  emptyMessage = "No records match the current filters.",
}: {
  rows: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchKeys?: (row: T) => string
  emptyMessage?: string
}) {
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true))
    const after = () => setPrinting(false)
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after)
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after) }
  }, [])

  const filtered = useMemo(() => {
    let out = rows
    if (query && searchKeys) {
      const q = query.toLowerCase()
      out = out.filter((r) => searchKeys(r).toLowerCase().includes(q))
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey)
      if (col) {
        const val = col.sortValue ?? ((r: T) => { const value = (r as Record<string, unknown>)[col.key]; return typeof value === "number" ? value : String(value ?? "") })
        out = [...out].sort((a, b) => {
          const av = val(a)
          const bv = val(b)
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))
          return sortDir === "asc" ? cmp : -cmp
        })
      }
    }
    return out
  }, [rows, query, sortKey, sortDir, columns, searchKeys])

  const toggleSort = (key: string) => {
    setPage(1)
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const start = (currentPage - 1) * pageSize
  return (
    <div className="flex flex-col gap-3">
      {searchable && searchKeys ? (
        <div className="relative max-w-xs print:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search..."
            className="pl-8"
            aria-label="Search table"
          />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sortKey === c.key ? sortDir === "asc" ? "ascending" : "descending" : undefined}
                  className={cn(
                    "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  )}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              (printing ? filtered : filtered.slice(start, start + pageSize)).map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-2.5 align-middle",
                        c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left",
                      )}
                    >
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm print:hidden"><span>{filtered.length ? start + 1 : 0}–{Math.min(start + pageSize, filtered.length)} of {filtered.length} records</span><div className="flex items-center gap-3"><label>Rows <select aria-label="Rows per page" className="rounded border bg-background p-1" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label><button className="rounded border px-2 py-1 disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button className="rounded border px-2 py-1 disabled:opacity-40" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
    </div>
  )
}

