
import { RevenueHistory } from "@/components/revenue-history"

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
import { amountInRand, displayAmount, originalCurrencyTotals, reportingAmount } from "@/lib/calculations/currency"
import { CurrencyDetails } from "@/components/currency-details"

export default function RevenuePage() {
  const { filters, displayCurrency } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const rev = revenueMetrics(data, filters)
  const originalRevenue = originalCurrencyTotals(data.revenue, record => record.amount)
  const usdTarget = data.overview.find(setting => setting.key === "CompanyRevenueTargetUSD")?.value
  const unconverted = data.revenue.filter(record => amountInRand(record.amount, record) === null).length

  const deptRevenue = data.departments.map((d) => {
    const attained = data.revenue
      .filter((r) => r.ownerDepartmentId === d.departmentId)
      .reduce((s, r) => s + (reportingAmount(r.amount, r) ?? 0), 0)
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
    { key: "reportingCurrency", header: "Conversion details", render: r => <CurrencyDetails record={r} amount={r.amount} /> },
    { key: "convertedAmount", header: "Reporting (ZAR)", render: r => reportingAmount(r.amount, r) === null ? "Not converted" : formatCurrency(reportingAmount(r.amount, r)!, "ZAR") },
    { key: "exchangeRate", header: "FX rate" },
    { key: "exchangeRateDate", header: "Rate date" },
    { key: "exchangeRateSource", header: "Rate source" },
    {
      key: "amount",
      header: displayCurrency === "source" ? "Original amount" : "Amount (ZAR)",
      align: "right",
      sortable: true,
      sortValue: r => displayCurrency === "source" ? r.amount : amountInRand(r.amount, r) ?? -1,
      render: (r) => (
        <span className="flex items-center justify-end gap-2">
          {displayAmount(r.amount, r, displayCurrency)}
          {displayCurrency === "ZAR" && <Badge variant={r.currency === "USD" ? "resell" : "muted"}>from {r.currency}</Badge>}
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
        description="Company and departmental revenue. Only the owning department is counted to prevent double counting; original currencies stay separate until converted to Rand."
        actions={<GlobalFilters currency />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Company target (ZAR)" value={formatCurrency(rev.targetZAR)} icon={Target} />
        {displayCurrency === "source" && usdTarget !== undefined && usdTarget !== "" && <KpiCard label="Company target (USD)" value={formatCurrency(Number(usdTarget), "USD")} icon={Target} />}
        {displayCurrency === "source" ? originalRevenue.map(total => <KpiCard key={total.currency} label={`Recorded (${total.currency})`} value={formatCurrency(total.value, total.currency)} icon={Banknote} tone="success" />) : <>
          <KpiCard label="Attained (ZAR)" value={formatCurrency(rev.attainedZAR)} icon={Banknote} tone="success" />
          <KpiCard label="Remaining (ZAR)" value={formatCurrency(rev.remainingZAR)} icon={TrendingUp} tone="warning" />
        </>}
      </section>
      {displayCurrency === "source" && <p className="text-sm text-muted-foreground">Recorded amounts retain their original currencies. Select All in Rand to compare them with the ZAR target; currencies are never added together in this view.</p>}
      {displayCurrency === "ZAR" && unconverted > 0 && <p className="text-sm text-warning">{unconverted} revenue record{unconverted === 1 ? " has" : "s have"} no documented ZAR conversion and {unconverted === 1 ? "is" : "are"} excluded from Rand totals.</p>}

      {displayCurrency === "ZAR" && <Card className="p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">ZAR attainment ({formatPercent(rev.attainmentPct)})</span>
          <span className="tabular-nums text-muted-foreground">
            {formatCurrency(rev.attainedZAR)} / {formatCurrency(rev.targetZAR)}
          </span>
        </div>
        <Progress value={rev.attainmentPct} tone="resell" className="mt-3 h-3" />
      </Card>}

      <section className="space-y-3">
        {displayCurrency === "ZAR" && <RevenueHistory />}
        <SectionHeading title="Department Revenue Targets (ZAR)" tone="resell" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {deptRevenue.map((d) => (
            <Card key={d.departmentId} className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{d.name}</span>
                {displayCurrency === "ZAR" && <span className="text-xs text-muted-foreground">{formatPercent(d.pct)}</span>}
              </div>
              {displayCurrency === "ZAR" && <Progress value={d.pct} tone="resell" className="mt-2" />}
              <p className="mt-1 text-xs text-muted-foreground">
                {displayCurrency === "ZAR" ? `${formatCurrency(d.attained)} / ${formatCurrency(d.target)}` : `${originalCurrencyTotals(data.revenue.filter(record => record.ownerDepartmentId === d.departmentId), record => record.amount).map(total => formatCurrency(total.value, total.currency)).join(" · ") || "No records"} recorded · ${formatCurrency(d.target)} ZAR target`}
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
