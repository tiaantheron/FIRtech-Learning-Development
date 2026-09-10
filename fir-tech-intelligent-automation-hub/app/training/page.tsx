

import { GraduationCap, Award, AlertTriangle, CircleCheck } from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { KpiCard } from "@/components/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  certMetrics,
  isCertValid,
  personName,
  trainingMetrics,
  hasOverride,
} from "@/lib/calculations/metrics"
import { formatDate, formatPercent, daysUntil } from "@/lib/utils/format"
import type { Certification, TrainingAssignment } from "@/lib/models/types"

export default function TrainingPage() {
  const { filters } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const training = trainingMetrics(data, filters)
  const certs = certMetrics(data, filters)

  const OUTSTANDING = new Set([
    "Not Allocated",
    "Allocated",
    "Not Started",
    "In Progress",
    "Exam Scheduled",
    "Awaiting Result",
    "Failed", "Expired",
  ])
  const outstanding = data.trainingAssignments.filter((t) => OUTSTANDING.has(t.status))

  // Department progress
  const deptProgress = data.departments.map((d) => {
    const people = new Set(
      data.people
        .filter((p) => p.primaryDepartmentId === d.departmentId || p.secondaryDepartmentIds.includes(d.departmentId))
        .map((p) => p.personId),
    )
    const items = data.trainingAssignments.filter((t) => people.has(t.personId))
    const done = items.filter((t) => t.status === "Completed" || t.status === "Passed").length
    return { name: d.name, done, total: items.length, pct: items.length ? done / items.length : 0 }
  })

  const trainingColumns: Column<TrainingAssignment>[] = [
    { key: "personId", header: "Person", sortable: true, render: (t) => personName(data, t.personId) },
    { key: "courseName", header: "Course", sortable: true },
    { key: "status", header: "Status", sortable: true, render: (t) => <StatusBadge status={t.status} /> },
    { key: "assignedDate", header: "Assigned", align: "right", render: (t) => formatDate(t.assignedDate) },
    {
      key: "dueDate",
      header: "Due",
      align: "right",
      sortable: true,
      sortValue: (t) => t.dueDate ?? "",
      render: (t) => {
        const d = daysUntil(t.dueDate)
        const overdue = d !== null && d < 0 && OUTSTANDING.has(t.status)
        return (
          <span className={overdue ? "font-medium text-destructive" : ""}>
            {formatDate(t.dueDate)}
            {overdue ? " (overdue)" : ""}
          </span>
        )
      },
    },
    { key: "completedDate", header: "Completed", align: "right", render: (t) => formatDate(t.completedDate) },
  ]

  const certColumns: Column<Certification>[] = [
    { key: "personId", header: "Person", sortable: true, render: (c) => personName(data, c.personId) },
    { key: "certName", header: "Certification", sortable: true },
    { key: "uiPathCertCode", header: "Code", render: (c) => <span className="font-mono text-xs">{c.uiPathCertCode || "—"}</span> },
    { key: "status", header: "Status", sortable: true, render: (c) => <StatusBadge status={c.status} /> },
    { key: "expiryDate", header: "Expiry", align: "right", sortable: true, sortValue: (c) => c.expiryDate ?? "", render: (c) => formatDate(c.expiryDate) },
    {
      key: "counts",
      header: "Counts toward",
      align: "center",
      render: (c) => {
        const valid = isCertValid(data, c)
        const overridden = hasOverride(data, "Certification", c.certificationId, "status")
        if (valid && overridden) return <Badge variant="warning">Yes (override)</Badge>
        return valid ? <Badge variant="success">Yes</Badge> : <Badge variant="muted">No</Badge>
      },
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Training & Certifications"
        description="Assignment, outstanding and certification dashboards. Expired certifications do not count toward attainment unless overridden."
        actions={<GlobalFilters />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Completion rate" value={formatPercent(training.completionRate)} icon={CircleCheck} tone="success" />
        <KpiCard label="Outstanding training" value={training.outstanding} sublabel={`${training.overdue} overdue`} icon={GraduationCap} tone="warning" />
        <KpiCard label="Valid certifications" value={certs.completed} sublabel={`${certs.expiring} expiring soon`} icon={Award} tone="services" />
        <KpiCard label="Expired certs" value={certs.expired} icon={AlertTriangle} tone="danger" />
      </section>

      <section className="space-y-3">
        <SectionHeading title="Department Training Progress" tone="services" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {deptProgress.map((d) => (
            <Card key={d.name} className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{d.name}</span>
                <span className="text-xs text-muted-foreground">
                  {d.done}/{d.total}
                </span>
              </div>
              <Progress value={d.pct} tone="services" className="mt-2" />
              <p className="mt-1 text-xs text-muted-foreground">{formatPercent(d.pct)} complete</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="Outstanding Training" tone="services" />
        <DataTable
          rows={outstanding}
          columns={trainingColumns}
          searchKeys={(t) => `${personName(data, t.personId)} ${t.courseName} ${t.status}`}
          emptyMessage="No outstanding training assignments."
        />
      </section>

      <section className="space-y-3">
        <SectionHeading title="All Assignments" />
        <DataTable
          rows={data.trainingAssignments}
          columns={trainingColumns}
          searchKeys={(t) => `${personName(data, t.personId)} ${t.courseName} ${t.status}`}
        />
      </section>

      <section className="space-y-3">
        <SectionHeading title="Certifications" tone="services" />
        <DataTable
          rows={data.certifications}
          columns={certColumns}
          searchKeys={(c) => `${personName(data, c.personId)} ${c.certName} ${c.uiPathCertCode}`}
        />
      </section>
    </div>
  )
}


