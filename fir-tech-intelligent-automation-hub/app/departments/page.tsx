

import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { GlobalFilters } from "@/components/global-filters"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DataTable, type Column } from "@/components/data-table"
import { GroupedBarChart } from "@/components/charts"
import { departmentPerformance, type DepartmentPerformance } from "@/lib/calculations/metrics"
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format"
import { originalCurrencyTotals } from "@/lib/calculations/currency"
import { weightedValue } from "@/lib/calculations/metrics"

export default function DepartmentsPage() {
  const { displayCurrency } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const perf = departmentPerformance(data)
  const deptById = new Map(data.departments.map((d) => [d.departmentId, d]))
  const sourceRevenue = (departmentId: string) => originalCurrencyTotals(data.revenue.filter(record => record.ownerDepartmentId === departmentId), record => record.amount)
  const sourcePipeline = (departmentId: string) => originalCurrencyTotals(data.opportunities.filter(record => record.departmentId === departmentId && !["closed won", "closed lost"].includes(record.stage.toLowerCase())), weightedValue)
  const joined = (items: { currency: string; value: number }[]) => items.length ? items.map(item => formatCurrency(item.value, item.currency)).join(" · ") : "No records"

  const chartData = perf.map((p) => ({
    name: p.name,
    Target: p.revenueTargetZAR,
    Attained: p.revenueAttainedZAR,
  }))

  const columns: Column<DepartmentPerformance>[] = [
    { key: "name", header: "Department", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "head", header: "Head", sortable: true },
    { key: "status", header: "Status", render: r => deptById.get(r.departmentId)?.status || "Active" },
    {
      key: "alloc",
      header: "Allocation",
      align: "right",
      render: (r) => formatPercent(deptById.get(r.departmentId)?.revenueAllocationPct ?? 0),
    },
    { key: "revenueTargetZAR", header: "Rev Target", align: "right", sortable: true, render: (r) => formatCurrency(r.revenueTargetZAR) },
    { key: "revenueAttainedZAR", header: "Rev Attained", align: "right", sortable: true, render: (r) => displayCurrency === "source" ? joined(sourceRevenue(r.departmentId)) : formatCurrency(r.revenueAttainedZAR) },
    {
      key: "revenuePct",
      header: "Performance",
      sortable: true,
      sortValue: (r) => displayCurrency === "source" ? (sourceRevenue(r.departmentId).find(item => item.currency === "ZAR")?.value ?? 0) / (r.revenueTargetZAR || 1) : r.revenuePct,
      render: (r) => (
        <div className="flex items-center gap-2">
          {displayCurrency === "ZAR" ? <><Progress value={r.revenuePct} tone="resell" className="w-24" /><span className="tabular-nums text-xs text-muted-foreground">{formatPercent(r.revenuePct)}</span></> : <span className="text-xs text-muted-foreground">Source currencies</span>}
        </div>
      ),
    },
    { key: "leadCount", header: "Leads", align: "right", sortable: true },
    { key: "opportunityCount", header: "Opps", align: "right", sortable: true },
    { key: "validCertifications", header: "Certs", align: "right", sortable: true },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Departments"
        actions={<GlobalFilters currency />}
        description="Ownership of revenue, pipeline and certification targets across FIRtech departments."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {perf.map((p) => {
          const dept = deptById.get(p.departmentId)
          return (
            <Card key={p.departmentId} className="p-5">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground">{dept?.status || "Active"}</p>
              <p className="text-xs text-muted-foreground">{p.head || "Unassigned"}</p>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Revenue target (ZAR)" value={formatCurrency(p.revenueTargetZAR)} />
                <Row label="Recorded revenue" value={displayCurrency === "source" ? joined(sourceRevenue(p.departmentId)) : formatCurrency(p.revenueAttainedZAR)} />
                {displayCurrency === "ZAR" && <Progress value={p.revenuePct} tone="resell" />}
                <Row label="Weighted pipeline" value={displayCurrency === "source" ? joined(sourcePipeline(p.departmentId)) : formatCurrency(p.weightedPipeline)} />
                <Row label="Lead target" value={`${p.leadCount} / ${formatNumber(dept?.leadTarget ?? 0)}`} />
                <Row label="Opp target" value={`${p.opportunityCount} / ${formatNumber(dept?.opportunityTarget ?? 0)}`} />
                <Row label="Qualifying engagements" value={p.qualifyingEngagements} />
              </div>
            </Card>
          )
        })}
      </section>

      {displayCurrency === "ZAR" && <section className="space-y-3">
        <SectionHeading title="Revenue: Target vs Attained (ZAR)" tone="resell" />
        <Card>
          <CardContent className="pt-5">
            <GroupedBarChart
              data={chartData}
              series={[
                { key: "Target", name: "Target", color: "var(--chart-1)" },
                { key: "Attained", name: "Attained", color: "var(--resell)" },
              ]}
              formatValue={(v) => `R${(v / 1_000_000).toFixed(1)}m`}
            />
          </CardContent>
        </Card>
      </section>}

      <section className="space-y-3">
        <SectionHeading title="Department Performance" />
        <DataTable rows={perf} columns={columns} searchKeys={(r) => `${r.name} ${r.head}`} />
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  )
}

