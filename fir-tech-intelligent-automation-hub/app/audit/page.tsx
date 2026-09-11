import { useMemo } from "react"
import { useWorkbook } from "@/lib/workbook-context"
import { readEditorSheet } from "@/lib/services/workbook-editor"
import { exportCSV, exportExcel, type ExportRow } from "@/lib/services/export"
import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export default function AuditPage() {
  const { buffer } = useWorkbook()
  const view = useMemo(() => buffer ? readEditorSheet(buffer, "Audit") : null, [buffer])
  if (!view) return null
  const rows: ExportRow[] = view.rows.map(r => Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, typeof v === "number" ? v : String(v)]))).reverse()
  return <div className="space-y-5"><PageHeader title="Audit History" description="Recorded changes, newest first. Read-only in this app; workbook files remain editable outside the app. Dashboard user is not an authenticated identity." actions={<div className="flex gap-2"><Button variant="outline" disabled={!rows.length} onClick={() => exportCSV(rows, "firtech-audit")}>CSV</Button><Button disabled={!rows.length} onClick={() => exportExcel(rows, "firtech-audit", "Audit")}>Excel</Button><Button variant="outline" onClick={() => window.print()}>Print</Button></div>} /><DataTable rows={rows} columns={view.headers.map(h => ({ key: h, header: h, sortable: true }))} searchKeys={r => Object.values(r).join(" ")} emptyMessage="No audit records supplied. The next edit will create the audit sheet automatically." /></div>
}
