

import { useWorkbookData } from "@/lib/workbook-context"
import { GlobalFilters } from "@/components/global-filters"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { PathwayCard } from "@/components/pathway-card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { getSetting, remainingValue, summarisePathway } from "@/lib/calculations/metrics"
import { formatDate, formatNumber } from "@/lib/utils/format"
import type { Requirement } from "@/lib/models/types"

export default function PathwaysPage() {
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const resell = summarisePathway(
    data.resellRequirements,
    getSetting(data, "ResellCurrentLevel", "—"),
    getSetting(data, "ResellTargetLevel", "Diamond"),
  )
  const services = summarisePathway(
    data.servicesRequirements,
    getSetting(data, "ServicesCurrentLevel", "—"),
    getSetting(data, "ServicesTargetLevel", "Gold"),
  )

  const columns: Column<Requirement>[] = [
    { key: "requirement", header: "Requirement", sortable: true, render: (r) => <span className="font-medium">{r.requirement}</span> },
    { key: "requiredValue", header: "Required", align: "right", sortable: true, render: (r) => `${formatNumber(r.requiredValue)} ${r.unit}` },
    { key: "attainedValue", header: "Attained", align: "right", sortable: true, render: (r) => `${formatNumber(r.attainedValue)} ${r.unit}` },
    {
      key: "remaining",
      header: "Remaining",
      align: "right",
      sortable: true,
      sortValue: (r) => remainingValue(r),
      render: (r) => {
        const rem = remainingValue(r)
        return <span className={rem > 0 ? "font-medium text-[oklch(0.5_0.13_75)]" : "text-[var(--success)]"}>{formatNumber(rem)} {r.unit}</span>
      },
    },
    { key: "owner", header: "Owner", sortable: true },
    { key: "dueDate", header: "Due", align: "right", sortable: true, sortValue: (r) => r.dueDate ?? "", render: (r) => formatDate(r.dueDate) },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Partner Pathways"
        actions={<GlobalFilters />}
        description="Requirements are loaded directly from the workbook and never hardcoded. Remaining = MAX(Required − Attained, 0). Supplied UiPath totals are preserved exactly."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PathwayCard title="Resell · Diamond" summary={resell} tone="resell" />
        <PathwayCard title="Services · Gold" summary={services} tone="services" />
      </div>

      <section className="space-y-3">
        <SectionHeading title="Resell Requirements" tone="resell" />
        <DataTable
          rows={data.resellRequirements}
          columns={columns}
          searchKeys={(r) => `${r.requirement} ${r.owner} ${r.status}`}
          emptyMessage="No Resell requirements found in the workbook."
        />
      </section>
      <section className="space-y-3"><SectionHeading title="Workbook Override Register" /><DataTable rows={data.overrides} columns={[{ key: "entityType", header: "Entity" }, { key: "entityId", header: "ID" }, { key: "field", header: "Field" }, { key: "value", header: "Override value" }, { key: "reason", header: "Reason" }]} searchKeys={o => `${o.entityId} ${o.reason}`} emptyMessage="No overrides supplied." /></section>

      <section className="space-y-3">
        <SectionHeading title="Services Requirements" tone="services" />
        <DataTable
          rows={data.servicesRequirements}
          columns={columns}
          searchKeys={(r) => `${r.requirement} ${r.owner} ${r.status}`}
          emptyMessage="No Services requirements found in the workbook."
        />
      </section>
    </div>
  )
}

