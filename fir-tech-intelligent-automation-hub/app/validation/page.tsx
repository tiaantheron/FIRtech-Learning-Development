

import { useMemo, useState } from "react"
import { CircleCheck, CircleAlert, TriangleAlert } from "lucide-react"
import { useWorkbook } from "@/lib/workbook-context"
import { PageHeader } from "@/components/page-header"
import { KpiCard } from "@/components/kpi-card"
import { DataTable, type Column } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { exportCSV } from "@/lib/services/export"
import { Button } from "@/components/ui/button"
import { FileDown } from "lucide-react"
import type { ValidationIssue } from "@/lib/models/types"

export default function ValidationPage() {
  const { result, user } = useWorkbook()
  const [severity, setSeverity] = useState<"all" | "error" | "warning">("all")
  const [sheet, setSheet] = useState("all")

  const issues = result?.issues ?? []
  const errors = issues.filter((i) => i.severity === "error").length
  const warnings = issues.filter((i) => i.severity === "warning").length
  const sheets = Array.from(new Set(issues.map((i) => i.worksheet))).sort()

  const filtered = useMemo(
    () =>
      issues.filter(
        (i) => (severity === "all" || i.severity === severity) && (sheet === "all" || i.worksheet === sheet),
      ),
    [issues, severity, sheet],
  )

  const columns: Column<ValidationIssue>[] = [
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (i) =>
        i.severity === "error" ? <Badge variant="danger">Error</Badge> : <Badge variant="warning">Warning</Badge>,
    },
    { key: "worksheet", header: "Worksheet", sortable: true, render: (i) => <span className="font-medium">{i.worksheet}</span> },
    { key: "row", header: "Row", align: "right", sortable: true, render: (i) => (i.row ?? "—") },
    { key: "field", header: "Field", render: (i) => i.field ?? "—" },
    { key: "message", header: "Description", render: (i) => <span className="text-muted-foreground">{i.message}</span> },
  ]

  if (user.Role !== "Administrator") return <p>Administrator permission is required.</p>
  return (
    <div className="space-y-6">
      <PageHeader
        title="Validation Console"
        description="Workbook structure and business-rule validation. Errors must be resolved; warnings should be reviewed. Nothing is silently ignored."
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered as unknown as Record<string, string | number>[], "firtech-validation")} disabled={filtered.length === 0}>
            <FileDown className="h-4 w-4" /> Export
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Errors" value={errors} icon={CircleAlert} tone={errors > 0 ? "danger" : "success"} />
        <KpiCard label="Warnings" value={warnings} icon={TriangleAlert} tone={warnings > 0 ? "warning" : "success"} />
        <KpiCard
          label="Status"
          value={!result ? "Not loaded" : errors === 0 ? "Valid" : "Invalid"}
          icon={CircleCheck}
          tone={errors === 0 ? "success" : "danger"}
          sublabel={result ? `Validated ${new Date(result.loadedAt).toLocaleString()}` : undefined}
        />
      </section>

      {issues.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 p-4 text-sm">
          <CircleCheck className="h-5 w-5 text-[var(--success)]" />
          <p>{result ? "All validation checks passed. The workbook structure and data are consistent." : "Upload a workbook to validate its structure and data."}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} aria-label="Filter by severity">
              <option value="all">All severities</option>
              <option value="error">Errors only</option>
              <option value="warning">Warnings only</option>
            </Select>
            <Select value={sheet} onChange={(e) => setSheet(e.target.value)} aria-label="Filter by worksheet">
              <option value="all">All worksheets</option>
              {sheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <DataTable
            rows={filtered}
            columns={columns}
            searchKeys={(i) => `${i.worksheet} ${i.field ?? ""} ${i.message}`}
            emptyMessage="No issues match the current filters."
          />
        </>
      )}
    </div>
  )
}


