

import { useMemo, useState } from "react"
import { X } from "lucide-react"
import { useWorkbookData } from "@/lib/workbook-context"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { departmentName, personName } from "@/lib/calculations/metrics"
import { formatDate } from "@/lib/utils/format"
import type { Person } from "@/lib/models/types"

export default function PeoplePage() {
  const data = useWorkbookData(false)
  const [deptFilter, setDeptFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected] = useState<string | null>(null)

  const people = useMemo(() => {
    if (!data) return []
    return data.people.filter((p) => {
      const deptOk =
        deptFilter === "all" || p.primaryDepartmentId === deptFilter || p.secondaryDepartmentIds.includes(deptFilter)
      const statusOk = statusFilter === "all" || p.employmentStatus === statusFilter
      return deptOk && statusOk
    })
  }, [data, deptFilter, statusFilter])

  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const statuses = Array.from(new Set(data.people.map((p) => p.employmentStatus).filter(Boolean)))
  const selectedPerson = data.people.find((p) => p.personId === selected) ?? null

  const columns: Column<Person>[] = [
    {
      key: "fullName",
      header: "Full name",
      sortable: true,
      render: (p) => (
        <button type="button" onClick={() => setSelected(p.personId)} className="font-medium text-primary hover:underline">
          {p.fullName}
        </button>
      ),
    },
    { key: "jobTitle", header: "Job title", sortable: true },
    { key: "primaryDepartmentId", header: "Primary dept", sortable: true, render: (p) => departmentName(data, p.primaryDepartmentId) },
    {
      key: "secondary",
      header: "Secondary",
      render: (p) =>
        p.secondaryDepartmentIds.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {p.secondaryDepartmentIds.map((d) => (
              <Badge key={d} variant="outline">
                {departmentName(data, d)}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: "managerId", header: "Manager", render: (p) => (p.managerId ? personName(data, p.managerId) : "—") },
    { key: "employmentStatus", header: "Status", sortable: true, render: (p) => <StatusBadge status={p.employmentStatus} /> },
    { key: "uiPathId", header: "UiPath ID", render: (p) => <span className="font-mono text-xs">{p.uiPathId || "—"}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Single source of employee records. A person may belong to multiple departments without duplication."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter by department">
              <option value="all">All departments</option>
              {data.departments.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <DataTable rows={people} columns={columns} searchKeys={(p) => `${p.fullName} ${p.jobTitle} ${p.uiPathId}`} />

      {selectedPerson ? <PersonDetail personId={selectedPerson.personId} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}

function PersonDetail({ personId, onClose }: { personId: string; onClose: () => void }) {
  const data = useWorkbookData(false)
  if (!data) return null
  const person = data.people.find((p) => p.personId === personId)
  if (!person) return null
  const certs = data.certifications.filter((c) => c.personId === personId)
  const training = data.trainingAssignments.filter((t) => t.personId === personId)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">
          {person.fullName} · <span className="font-normal text-muted-foreground">{person.jobTitle}</span>
        </CardTitle>
        <button type="button" onClick={onClose} aria-label="Close detail" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Certification history
          </h4>
          {certs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No certifications on record.</p>
          ) : (
            <ul className="space-y-2">
              {certs.map((c) => (
                <li key={c.certificationId} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{c.certName}</p>
                    <p className="text-xs text-muted-foreground">Expires {formatDate(c.expiryDate)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Training history</h4>
          {training.length === 0 ? (
            <p className="text-sm text-muted-foreground">No training assignments on record.</p>
          ) : (
            <ul className="space-y-2">
              {training.map((t) => (
                <li key={t.assignmentId} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{t.courseName}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(t.dueDate)}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

