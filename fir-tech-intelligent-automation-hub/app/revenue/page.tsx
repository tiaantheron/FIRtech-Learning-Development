"use client"

import { Banknote, Target, TrendingUp, Info } from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { KpiCard } from "@/components/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DataTable, type Column } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { departmentName, revenueMetrics } from "@/lib/calculations/metrics"
import { formatCurrency, formatPercent } from "@/lib/utils/format"
import type { RevenueRecord } from "@/lib/models/types"

export default function RevenuePage() {
  const { filters } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const rev = revenueMetrics(data, filters)

  const deptRevenue = data.departments.map((d) => {
    const attained = data.revenue
      .filter((r) => r.ownerDepartmentId === d.departmentId && r.currency === "ZAR")
      .reduce((s, r) => s + r.amount, 0)
    return {
      departmentId: d.departmentId,
      name: d.name,
      target: d.revenueTargetZAR,
      attained,
      pct: d.revenueTargetZAR ? attained / d.revenueTargetZAR : 0,
    }
  })

  const columns: Column<RevenueRecord>[] = [
    { key: "customer", header: "Customer", sortable: true, render: (r) => <span className="font-medium">{r.customer}</span> },
    { key: "type", header: "Type", sortable: true },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className="flex items-center justify-end gap-2">
          {formatCurrency(r.amount, r.currency)}
          <Badge variant={r.currency === "USD" ? "resell" : "muted"}>{r.currency}</Badge>
        </span>
      ),
    },
    { key: "ownerDepartmentId", header: "Owner (counted)", render: (r) => departmentName(data, r.ownerDepartmentId) },
    { key: "leadOriginDepartmentId", header: "Lead origin", render: (r) => departmentName(data, r.leadOriginDepartmentId) },
    { key: "influencingDepartmentId", header: "Influencing", render: (r) => (r.influencingDepartmentId ? departmentName(data, r.influencingDepartmentId) : "—") },
    { key: "deliveringDepartmentId", header: "Delivering", render: (r) => departmentName(data, r.deliveringDepartmentId) },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Revenue"
        description="Company and departmental revenue. Only the owning department is counted to prevent double counting; UiPath USD and internal ZAR are tracked separately."
        actions={<GlobalFilters />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Company target (ZAR)" value={formatCurrency(rev.targetZAR)} icon={Target} />
        <KpiCard label="Attained (ZAR)" value={formatCurrency(rev.attainedZAR)} icon={Banknote} tone="success" />
        <KpiCard label="Remaining (ZAR)" value={formatCurrency(rev.remainingZAR)} icon={TrendingUp} tone="warning" />
        <KpiCard label="UiPath revenue (USD)" value={formatCurrency(rev.attainedUSD, "USD")} icon={Banknote} tone="resell" sublabel="Tracked separately from ZAR" />
      </section>

      <Card className="p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">ZAR attainment ({formatPercent(rev.attainmentPct)})</span>
          <span className="tabular-nums text-muted-foreground">
            {formatCurrency(rev.attainedZAR)} / {formatCurrency(rev.targetZAR)}
          </span>
        </div>
        <Progress value={rev.attainmentPct} tone="resell" className="mt-3 h-3" />
      </Card>

      <section className="space-y-3">
        <SectionHeading title="Department Revenue Targets (ZAR)" tone="resell" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {deptRevenue.map((d) => (
            <Card key={d.departmentId} className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{d.name}</span>
                <span className="text-xs text-muted-foreground">{formatPercent(d.pct)}</span>
              </div>
              <Progress value={d.pct} tone="resell" className="mt-2" />
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(d.attained)} / {formatCurrency(d.target)}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Each revenue record attributes credit to a single owning department for target purposes. Lead-origin,
          influencing and delivering departments are recorded for insight but never re-counted toward revenue totals.
        </p>
      </div>

      <section className="space-y-3">
        <SectionHeading title="Revenue Records" />
        <DataTable rows={data.revenue} columns={columns} searchKeys={(r) => `${r.customer} ${r.type} ${r.currency}`} />
      </section>
    </div>
  )
}
