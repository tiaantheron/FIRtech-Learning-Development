"use client"

import { Target, TrendingUp, TrendingDown, CircleCheck } from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { KpiCard } from "@/components/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { HBarChart } from "@/components/charts"
import { departmentName, personName, pipelineMetrics, weightedValue } from "@/lib/calculations/metrics"
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils/format"
import type { Lead, Opportunity } from "@/lib/models/types"

export default function PipelinePage() {
  const { filters } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const pipe = pipelineMetrics(data, filters)

  const byDept = data.departments.map((d) => ({
    name: d.name,
    value: data.opportunities.filter((o) => o.departmentId === d.departmentId).reduce((s, o) => s + weightedValue(o), 0),
  }))

  const leadColumns: Column<Lead>[] = [
    { key: "customer", header: "Customer", sortable: true, render: (l) => <span className="font-medium">{l.customer}</span> },
    { key: "owner", header: "Owner", render: (l) => personName(data, l.owner) },
    { key: "departmentId", header: "Department", sortable: true, render: (l) => departmentName(data, l.departmentId) },
    { key: "estimatedValue", header: "Value", align: "right", sortable: true, render: (l) => formatCurrency(l.estimatedValue, l.currency) },
    { key: "source", header: "Source" },
    { key: "status", header: "Status", sortable: true, render: (l) => <StatusBadge status={l.status} /> },
    { key: "createdDate", header: "Created", align: "right", render: (l) => formatDate(l.createdDate) },
  ]

  const oppColumns: Column<Opportunity>[] = [
    { key: "name", header: "Opportunity", sortable: true, render: (o) => <span className="font-medium">{o.name}</span> },
    { key: "customer", header: "Customer", sortable: true },
    { key: "owner", header: "Owner", render: (o) => personName(data, o.owner) },
    { key: "departmentId", header: "Department", sortable: true, render: (o) => departmentName(data, o.departmentId) },
    { key: "estimatedValue", header: "Value", align: "right", sortable: true, render: (o) => formatCurrency(o.estimatedValue, o.currency) },
    { key: "probability", header: "Prob.", align: "right", sortable: true, render: (o) => formatPercent(o.probability) },
    {
      key: "weighted",
      header: "Weighted",
      align: "right",
      sortable: true,
      sortValue: (o) => weightedValue(o),
      render: (o) => <span className="font-medium">{formatCurrency(weightedValue(o), o.currency)}</span>,
    },
    { key: "stage", header: "Stage", sortable: true, render: (o) => <StatusBadge status={o.stage} /> },
    { key: "closeDate", header: "Close", align: "right", render: (o) => formatDate(o.closeDate) },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leads & Opportunities"
        description="Pipeline health and weighted forecast. Weighted value = estimated value × probability (Closed Won = 100%, Closed Lost = 0%)."
        actions={<GlobalFilters />}
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Leads" value={pipe.leads} icon={Target} />
        <KpiCard label="Open opps" value={pipe.openOpportunities} icon={Target} />
        <KpiCard label="Total pipeline" value={formatCurrency(pipe.totalPipeline)} icon={TrendingUp} tone="resell" />
        <KpiCard label="Weighted pipeline" value={formatCurrency(pipe.weightedPipeline)} icon={TrendingUp} tone="resell" />
        <KpiCard label="Won revenue" value={formatCurrency(pipe.wonRevenue)} icon={CircleCheck} tone="success" />
        <KpiCard label="Conversion" value={formatPercent(pipe.conversionRate)} sublabel={`Lost ${formatCurrency(pipe.lostRevenue)}`} icon={TrendingDown} tone="warning" />
      </section>

      <section className="space-y-3">
        <SectionHeading title="Weighted Pipeline by Department" tone="resell" />
        <Card>
          <CardContent className="pt-5">
            <HBarChart data={byDept} color="var(--resell)" formatValue={(v) => `R${(v / 1_000_000).toFixed(1)}m`} />
          </CardContent>
        </Card>
      </section>

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
