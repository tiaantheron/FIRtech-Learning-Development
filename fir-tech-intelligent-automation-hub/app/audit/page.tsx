import { useMemo } from "react"
import { useWorkbook } from "@/lib/workbook-context"
import { readEditorSheet } from "@/lib/services/workbook-editor"
import { exportCSV, exportExcel, type ExportRow } from "@/lib/services/export"
import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export default function AuditPage() {
  const { buffer, user, result } = useWorkbook()
  const view = useMemo(() => buffer ? readEditorSheet(buffer, "Audit") : null, [buffer])
  if (user.Role !== "Administrator") return <p>Administrator permission is required to view audit history.</p>
  if (!view) return null
  const rows: ExportRow[] = view.rows.map(r => Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, typeof v === "number" ? v : String(v)]))).reverse()
  const exportRows = rows.map(row => ({ ...row, "Source status": result?.data?.overview.find(s => s.key === "DataStatus")?.value || "Not supplied" }))
  return <div className="space-y-5"><PageHeader title="Audit History" description="Recorded changes, newest first. Read-only in this app; workbook files remain editable outside the app. The built-in administrator is recorded as System administrator." actions={<div className="flex gap-2"><Button variant="outline" disabled={!rows.length} onClick={() => exportCSV(exportRows, "firtech-audit")}>CSV</Button><Button disabled={!rows.length} onClick={() => exportExcel(exportRows, "firtech-audit", "Audit")}>Excel</Button><Button variant="outline" onClick={() => window.print()}>Print</Button></div>} /><DataTable rows={rows} columns={[...["Timestamp", "User", "RecordType", "RecordID", "Action", "Reason"].filter(h => view.headers.includes(h)).map(h => ({ key: h, header: h, sortable: true })), { key: "details", header: "Details", render: r => <details className="w-64"><summary className="cursor-pointer font-medium">View changes</summary><dl className="mt-2 space-y-2 break-words text-xs">{["AuditID", "PreviousValue", "NewValue"].map(h => <div key={h}><dt className="font-semibold">{h}</dt><dd className="whitespace-pre-wrap break-all">{String(r[h] ?? "")}</dd></div>)}</dl></details> }]} searchKeys={r => Object.values(r).join(" ")} emptyMessage="No audit records supplied. The next edit will create the audit sheet automatically." /></div>
}
