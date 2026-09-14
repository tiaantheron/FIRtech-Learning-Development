

import { useMemo, useState } from "react"
import { FileDown, FileSpreadsheet, Printer } from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/data-table"
import { cn } from "@/lib/utils"
import { REPORTS } from "@/lib/reports/reports"
import { Select } from "@/components/ui/select"
import { exportCSV, exportExcel, type ExportRow } from "@/lib/services/export"

export default function ReportsPage() {
  const { filters, user, result } = useWorkbook()
  const canExport = user.Role === "Administrator" || user.ExportReports
  const data = useWorkbookData(false)
  const [employeeId, setEmployeeId] = useState("all")
  const [activeId, setActiveId] = useState(REPORTS[0].id)

  const active = REPORTS.find((r) => r.id === activeId) ?? REPORTS[0]

  const supportsEmployee = ["training-outstanding", "certification", "pipeline", "certifications-outstanding", "certifications-completed", "certifications-expiring", "assignments-overdue", "pipeline-owner"].includes(activeId)
  const rows: ExportRow[] = useMemo(() => (data ? active.build(data, { ...filters, employeeId: supportsEmployee ? employeeId : "all" }) : []), [data, active, filters, employeeId, supportsEmployee])

  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const columns: Column<ExportRow>[] = headers.map((h) => ({
    key: h,
    header: h,
    sortable: true,
    align: typeof rows[0]?.[h] === "number" ? "right" : "left",
    sortValue: (r) => r[h] as string | number,
  }))

  const exportRows = rows.map(row => ({ ...row, "Source status": result?.data?.overview.find(s => s.key === "DataStatus")?.value || "Not supplied" }))
  const fileBase = `firtech-${active.id}`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate, filter and export executive reports. Exports respect the selected department and reporting period."
        actions={<div className="flex flex-wrap gap-2"><GlobalFilters />{supportsEmployee && <Select aria-label="Employee filter" value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="all">All employees</option>{data.people.map(p => <option key={p.personId} value={p.personId}>{p.fullName}</option>)}</Select>}</div>}
      />
      <p className="text-sm text-muted-foreground">Period: {data.reportingPeriods.find(p => p.periodId === filters.periodId)?.name ?? "All periods"} · Department: {data.departments.find(d => d.departmentId === filters.departmentId)?.name ?? "All departments"}{supportsEmployee && ` · Person: ${data.people.find(p => p.personId === employeeId)?.fullName ?? "All people"}`}</p>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-1 print:hidden">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveId(r.id)}
              className={cn(
                "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                r.id === activeId ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {r.name}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">{active.name}</h2>
                <p className="text-sm text-muted-foreground">{active.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!canExport} onClick={() => { if (canExport) window.print() }}><Printer className="h-4 w-4" />Print</Button>
                <Button variant="outline" size="sm" onClick={() => { if (canExport) exportCSV(exportRows, fileBase) }} disabled={!canExport || rows.length === 0}>
                  <FileDown className="h-4 w-4" /> CSV
                </Button>
                <Button size="sm" onClick={() => { if (canExport) exportExcel(exportRows, fileBase, active.name) }} disabled={!canExport || rows.length === 0}>
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          <DataTable
            rows={rows}
            columns={columns}
            searchKeys={(r) => Object.values(r).join(" ")}
            emptyMessage="No data for this report under the current filters."
          />
        </div>
      </div>
    </div>
  )
}
