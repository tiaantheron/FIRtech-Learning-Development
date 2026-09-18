
import { CurrencyDetails } from "@/components/currency-details"
import { amountInRand, displayAmount, originalCurrencyTotals } from "@/lib/calculations/currency"

import { Target, TrendingUp, TrendingDown, CircleCheck } from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { KpiCard } from "@/components/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { HBarChart } from "@/components/charts"
import { departmentName, personName, pipelineMetrics, weightedValue, effectiveProbability } from "@/lib/calculations/metrics"
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils/format"
import type { Lead, Opportunity } from "@/lib/models/types"

export default function PipelinePage() {
  const { filters, displayCurrency } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const pipe = pipelineMetrics(data, filters)
  const openOpportunities = data.opportunities.filter(o => !["closed won", "closed lost"].includes(o.stage.toLowerCase()))
  const sourcePipeline = originalCurrencyTotals(openOpportunities, o => o.estimatedValue)
  const sourceWeighted = originalCurrencyTotals(openOpportunities, weightedValue)
  const unconverted = data.opportunities.filter(o => amountInRand(o.estimatedValue, o) === null).length

  const byDept = data.departments.map((d) => ({
    name: d.name,
    value: pipelineMetrics(data, { ...filters, departmentId: d.departmentId }).weightedPipeline,
  }))

  const leadColumns: Column<Lead>[] = [
    { key: "customer", header: "Customer", sortable: true, render: (l) => <span className="font-medium">{l.customer}</span> },
    { key: "owner", header: "Owner", render: (l) => personName(data, l.owner) },
    { key: "departmentId", header: "Department", sortable: true, render: (l) => departmentName(data, l.departmentId) },
    { key: "estimatedValue", header: "Value", align: "right", sortable: true, sortValue: l => displayCurrency === "source" ? l.estimatedValue : amountInRand(l.estimatedValue, l) ?? -1, render: (l) => displayAmount(l.estimatedValue, l, displayCurrency) },
    { key: "source", header: "Source" },
    { key: "conversion", header: "Reporting / FX", render: l => <CurrencyDetails record={l} amount={l.estimatedValue} /> },
    { key: "status", header: "Status", sortable: true, render: (l) => <StatusBadge status={l.status} /> },
    { key: "createdDate", header: "Created", align: "right", render: (l) => formatDate(l.createdDate) },
  ]

  const oppColumns: Column<Opportunity>[] = [
    { key: "name", header: "Opportunity", sortable: true, render: (o) => <span className="font-medium">{o.name}</span> },
    { key: "customer", header: "Customer", sortable: true },
    { key: "conversion", header: "Reporting / FX", render: o => <CurrencyDetails record={o} amount={o.estimatedValue} /> },
    { key: "owner", header: "Owner", render: (o) => personName(data, o.owner) },
    { key: "departmentId", header: "Department", sortable: true, render: (o) => departmentName(data, o.departmentId) },
    { key: "estimatedValue", header: "Value", align: "right", sortable: true, sortValue: o => displayCurrency === "source" ? o.estimatedValue : amountInRand(o.estimatedValue, o) ?? -1, render: (o) => displayAmount(o.estimatedValue, o, displayCurrency) },
    { key: "probability", header: "Prob.", align: "right", sortable: true, sortValue: effectiveProbability, render: (o) => formatPercent(effectiveProbability(o)) },
    {
      key: "weighted",
      header: "Weighted",
      align: "right",
      sortable: true,
      sortValue: (o) => displayCurrency === "source" ? weightedValue(o) : amountInRand(weightedValue(o), o) ?? -1,
      render: (o) => <span className="font-medium">{displayAmount(weightedValue(o), o, displayCurrency)}</span>,
    },
    { key: "stage", header: "Stage", sortable: true, render: (o) => <StatusBadge status={o.stage} /> },
    { key: "closeDate", header: "Close", align: "right", render: (o) => formatDate(o.closeDate) },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leads & Opportunities"
        description="Pipeline health and weighted forecast. Weighted value = estimated value × probability (Closed Won = 100%, Closed Lost = 0%)."
        actions={<GlobalFilters currency />}
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Leads" value={pipe.leads} icon={Target} />
        <KpiCard label="Open opps" value={pipe.openOpportunities} icon={Target} />
        {displayCurrency === "ZAR" && <>
          <KpiCard label="Total pipeline (ZAR)" value={formatCurrency(pipe.totalPipeline)} icon={TrendingUp} tone="resell" />
          <KpiCard label="Weighted pipeline (ZAR)" value={formatCurrency(pipe.weightedPipeline)} icon={TrendingUp} tone="resell" />
          <KpiCard label="Won opportunity value (ZAR)" value={formatCurrency(pipe.wonRevenue)} icon={CircleCheck} tone="success" />
        </>}
        <KpiCard label="Closed opportunity win rate" value={formatPercent(pipe.conversionRate)} icon={TrendingDown} tone="warning" />
      </section>
      {displayCurrency === "source" && <section className="space-y-3">
        <SectionHeading title="Open pipeline by original currency" tone="resell" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sourcePipeline.length ? sourcePipeline.map(total => <Card key={total.currency} className="p-4">
          <p className="font-semibold">{total.currency}</p>
          <p className="mt-2 text-sm">Total: {formatCurrency(total.value, total.currency)}</p>
          <p className="text-sm">Weighted: {formatCurrency(sourceWeighted.find(value => value.currency === total.currency)?.value ?? 0, total.currency)}</p>
        </Card>) : <p className="text-sm text-muted-foreground">No open opportunities for these filters.</p>}</div>
      </section>}
      {displayCurrency === "ZAR" && unconverted > 0 && <p className="text-sm text-warning">{unconverted} opportunity value{unconverted === 1 ? " has" : "s have"} no documented ZAR conversion and {unconverted === 1 ? "is" : "are"} excluded from Rand totals.</p>}

      {displayCurrency === "ZAR" && <section className="space-y-3">
        <SectionHeading title="Open Weighted Pipeline by Department (ZAR)" tone="resell" />
        <Card>
          <CardContent className="pt-5">
            <HBarChart data={byDept} color="var(--resell)" formatValue={(v) => `R${(v / 1_000_000).toFixed(1)}m`} />
          </CardContent>
        </Card>
      </section>}

      <section className="space-y-3">
        <SectionHeading title="Opportunities" />
        <DataTable rows={data.opportunities} columns={oppColumns} searchKeys={(o) => `${o.name} ${o.customer} ${o.stage}`} />
      </section>

      <section className="space-y-3">
        <SectionHeading title="Leads" />
        <DataTable rows={data.leads} columns={leadColumns} searchKeys={(l) => `${l.customer} ${l.source} ${l.status}`} />
      </section>
    </div>
  )
}
