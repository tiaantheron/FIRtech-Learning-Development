"use client"

import { Handshake, CircleCheck, Star, Users } from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { KpiCard } from "@/components/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { DonutChart } from "@/components/charts"
import { engagementMetrics } from "@/lib/calculations/metrics"
import { formatCurrency } from "@/lib/utils/format"
import type { Engagement } from "@/lib/models/types"

export default function EngagementsPage() {
  const { filters } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const eng = engagementMetrics(data, filters)

  const mix = [
    { name: "Resell customer", value: data.engagements.filter((e) => e.type === "Resell Customer Engagement").length, color: "var(--resell)" },
    { name: "Professional services", value: data.engagements.filter((e) => e.type === "Professional Services Engagement").length, color: "var(--services)" },
    { name: "Unique PS", value: data.engagements.filter((e) => e.type === "Unique Professional Services Engagement").length, color: "var(--chart-4)" },
    { name: "Non-qualifying", value: data.engagements.filter((e) => e.type === "Non-Qualifying Engagement").length, color: "var(--muted-foreground)" },
  ]

  const columns: Column<Engagement>[] = [
    { key: "customer", header: "Customer", sortable: true, render: (e) => <span className="font-medium">{e.customer}</span> },
    { key: "name", header: "Engagement", sortable: true },
    {
      key: "type",
      header: "Category",
      sortable: true,
      render: (e) => {
        const variant =
          e.type === "Non-Qualifying Engagement"
            ? "muted"
            : e.type === "Resell Customer Engagement"
              ? "resell"
              : "services"
        return <Badge variant={variant}>{e.type.replace(" Engagement", "")}</Badge>
      },
    },
    { key: "qualificationStatus", header: "Qualification", sortable: true, render: (e) => <StatusBadge status={e.qualificationStatus} /> },
    { key: "contractValue", header: "Contract", align: "right", sortable: true, render: (e) => formatCurrency(e.contractValue, e.currency) },
    { key: "npsStatus", header: "NPS", align: "center", render: (e) => <StatusBadge status={e.npsStatus} /> },
    { key: "csatStatus", header: "CSAT", align: "center", render: (e) => <StatusBadge status={e.csatStatus} /> },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Engagements"
        description="Customer and professional services engagements. Duplicate qualifying engagements are flagged and unique PS engagements are de-duplicated by customer."
        actions={<GlobalFilters />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total engagements" value={eng.total} icon={Handshake} />
        <KpiCard label="Qualifying" value={eng.qualifying} icon={CircleCheck} tone="success" />
        <KpiCard label="Unique PS" value={eng.uniqueProfessionalServices} icon={Star} tone="services" sublabel="De-duplicated by customer" />
        <KpiCard label="Non-qualifying" value={eng.nonQualifying} icon={Users} tone="muted" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <SectionHeading title="Engagement Mix" tone="services" />
          <Card>
            <CardContent className="pt-5">
              <DonutChart data={mix} />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-3 lg:col-span-2">
          <SectionHeading title="Qualification Readiness" />
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadinessCard label="Resell customer engagements" value={eng.customer} hint="Count toward Resell pathway" tone="resell" />
            <ReadinessCard label="Professional services" value={eng.professionalServices} hint="Includes unique PS" tone="services" />
            <ReadinessCard label="Qualifying engagements" value={eng.qualifying} hint="NPS/CSAT & status qualified" tone="success" />
            <ReadinessCard label="Unique PS (deduped)" value={eng.uniqueProfessionalServices} hint="Distinct customers" tone="services" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="All Engagements" />
        <DataTable rows={data.engagements} columns={columns} searchKeys={(e) => `${e.customer} ${e.name} ${e.type}`} />
      </section>
    </div>
  )
}

function ReadinessCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone: "resell" | "services" | "success"
}) {
  const color = { resell: "text-[var(--resell)]", services: "text-[var(--services)]", success: "text-[var(--success)]" }[tone]
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  )
}
