import { canEditSheet, rowAllowed } from "@/lib/services/permissions"
import { deriveRow, DERIVED_COLUMNS } from "@/lib/services/derived-row"
import { useMemo, useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { useWorkbook } from "@/lib/workbook-context"
import { readEditorSheet, workbookSheetNames, type CellValue, type EditableRow } from "@/lib/services/workbook-editor"
import { Button } from "./ui/button"
import { DataTable } from "./data-table"

const routeSheets: Record<string, string[]> = {
  "/": ["Settings", "Overview", "Departments", "Requirements", "ResellRequirements", "ServicesRequirements", "ReportingPeriods"],
  "/departments": ["Departments", "Memberships", "DepartmentMemberships"], "/people": ["People", "Memberships", "DepartmentMemberships"],
  "/training": ["Training", "TrainingAssignments", "Certifications"], "/pipeline": ["Opportunities", "Leads"], "/revenue": ["Revenue"],
  "/engagements": ["Engagements"], "/pathways": ["Requirements", "ResellRequirements", "ServicesRequirements", "Overrides"],
}
export function WorkbookEditor({ route }: { route: string }) {
  const { buffer, editRecord, loading, connected, user, result } = useWorkbook()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("")
  const [editing, setEditing] = useState<EditableRow | null>(null)
  const [error, setError] = useState("")
  const names = useMemo(() => buffer ? workbookSheetNames(buffer) : [], [buffer])
  const allowed = (routeSheets[route] ?? names).filter(n => names.includes(n) || ["Revenue", "Leads", "Certifications", "Overrides", "ReportingPeriods"].includes(n)).filter(n => n !== "Audit" && n !== "Users" && n !== "Evidence" && canEditSheet(user, n))
  const sheet = allowed.includes(selected) ? selected : allowed[0]
  const view = useMemo(() => buffer && sheet ? readEditorSheet(buffer, sheet) : null, [buffer, sheet])
  if (!view || !canEditSheet(user, sheet)) return null
  const lifecycleField = sheet === "People" ? "EmploymentStatus" : sheet === "Departments" ? "Status" : null

  const changeValue = (field: string, value: CellValue) => {
    if (!editing) return
    const next = deriveRow({ ...editing.values, [field]: value }, view.headers)
    setEditing({ ...editing, values: next })
  }
  const submit = async (action: "save" | "delete", record: EditableRow) => {
    setError("")
    try { await editRecord(sheet, record.row || null, record.values, action); setEditing(null) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  return <section className="mb-6 rounded-lg border bg-card p-4 print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Manage this section</h2><p className="text-sm text-muted-foreground">{connected ? "Apply an edit to update the dashboard and save the source Excel file automatically." : "Apply edits to update the dashboard, then Download Excel to retain your changes."}</p></div><Button variant="outline" onClick={() => { setOpen(!open); setEditing(null); setError("") }}><Pencil className="h-4 w-4" />{open ? "Close editor" : "Manage records"}</Button></div>
    {open && <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-3"><select aria-label="Worksheet to edit" className="rounded border bg-background p-2 text-sm" value={sheet} onChange={e => { setSelected(e.target.value); setEditing(null); setError("") }}>{allowed.map(n => <option key={n}>{n}</option>)}</select><Button disabled={loading} onClick={() => { setError(""); setEditing({ row: 0, values: Object.fromEntries(view.headers.map(h => [h, h === "Currency" || h === "ReportingCurrency" ? "ZAR" : ""])) }) }}><Plus className="h-4 w-4" />Add entry</Button></div>
      <p className="text-sm text-muted-foreground">Records in your permitted departments are shown here, independent of dashboard filters. Required IDs must be unique. Rates are reporting-currency units per original-currency unit.</p>
      {error && <pre role="alert" className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-destructive p-3 font-sans text-sm text-destructive">{error}</pre>}
      {editing && <form className="rounded-lg border bg-muted/30 p-4" onSubmit={e => { e.preventDefault(); void submit("save", editing) }}>
        <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{editing.row ? `Edit row ${editing.row}` : "New entry"} · {sheet}</h3><button type="button" aria-label="Close entry editor" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{view.headers.map(h => {
          const locked = DERIVED_COLUMNS.includes(h) || !!view.formulas[`${editing.row}:${h}`]
          const numeric = view.numeric.includes(h)
          return <label key={h} className="text-sm font-medium">{h === "Currency" ? "Currency (original transaction)" : h.replace(/([a-z])([A-Z])/g, "$1 $2")}{locked && " (calculated)"}<input className="mt-1 block w-full rounded border bg-background p-2 font-normal disabled:bg-muted" disabled={locked || loading} type={numeric ? "number" : /Date$|DueDate|ExpectedClose/.test(h) ? "date" : "text"} step={numeric ? "any" : undefined} value={String(editing.values[h] ?? "")} onChange={e => changeValue(h, numeric && e.target.value !== "" ? Number(e.target.value) : e.target.value)} /></label>
        })}</div><div className="mt-4 flex gap-3"><Button disabled={loading} type="submit">{loading ? "Updating…" : "Apply to workbook"}</Button><Button type="button" variant="outline" disabled={loading} onClick={() => setEditing(null)}>Cancel</Button></div>
      </form>}
      <DataTable rows={view.rows.filter(r => result?.data && rowAllowed(user, result.data, sheet, r.values))} searchKeys={r => Object.values(r.values).join(" ")} columns={[...view.headers.slice(0, 5).map(h => ({ key: h, header: h, render: (r: EditableRow) => String(r.values[h] ?? ""), sortable: true, sortValue: (r: EditableRow) => String(r.values[h] ?? "") })), { key: "actions", header: "Actions", render: r => <div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading} onClick={() => { setEditing({ row: r.row, values: { ...r.values } }); setError("") }}><Pencil className="h-4 w-4" />Edit</Button><Button variant="outline" size="sm" disabled={loading || user.Role !== "Administrator"} onClick={() => { if (window.confirm(`${lifecycleField ? "Archive" : "Remove"} ${String(r.values[view.headers[0]])} from ${sheet}? You can undo this change.`)) void submit("delete", r) }}><Trash2 className="h-4 w-4" />{lifecycleField ? "Archive" : "Remove"}</Button>{lifecycleField && String(r.values[lifecycleField]).toLowerCase() === "archived" && <Button variant="outline" size="sm" disabled={loading || user.Role !== "Administrator"} onClick={() => { if (window.confirm("Restore this archived record?")) void submit("save", { ...r, values: { ...r.values, [lifecycleField]: "Active" } }) }}>Restore</Button>}</div> }]} />
    </div>}
  </section>
}


