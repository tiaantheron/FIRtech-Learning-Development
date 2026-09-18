import { Award, AlertTriangle, CircleCheck, GraduationCap } from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { KpiCard } from "@/components/kpi-card"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DataTable, type Column } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { courseState, courseSummaries, isOutstandingCourse, type CourseState } from "@/lib/calculations/courses"
import { certMetrics, hasOverride, isCertValid, personName, trainingMetrics } from "@/lib/calculations/metrics"
import { daysUntil, formatDate, formatPercent } from "@/lib/utils/format"
import type { Certification, TrainingAssignment } from "@/lib/models/types"

const stateLabels: Record<CourseState, string> = {
  done: "Done", doing: "Doing", planned: "Will do", attention: "Needs attention", excluded: "Excluded",
}

export default function CoursesPage() {
  const { filters } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available.</p>

  const training = trainingMetrics(data, filters)
  const certs = certMetrics(data, filters)
  const courses = courseSummaries(data, filters)

  const trainingColumns: Column<TrainingAssignment>[] = [
    { key: "personId", header: "Person", sortable: true, render: assignment => personName(data, assignment.personId) },
    { key: "courseName", header: "Course", sortable: true },
    { key: "state", header: "Plan", sortable: true, sortValue: assignment => courseState(assignment), render: assignment => stateLabels[courseState(assignment)] },
    { key: "status", header: "Status", sortable: true, render: assignment => <StatusBadge status={assignment.status} /> },
    { key: "assignedDate", header: "Assigned", render: assignment => formatDate(assignment.assignedDate) },
    { key: "dueDate", header: "Due", sortable: true, sortValue: assignment => assignment.dueDate ?? "", render: assignment => {
      const overdue = isOutstandingCourse(assignment) && (daysUntil(assignment.dueDate) ?? 0) < 0
      return <span className={overdue ? "font-medium text-destructive" : ""}>{formatDate(assignment.dueDate)}{overdue ? " (overdue)" : ""}</span>
    } },
    { key: "completedDate", header: "Completed", render: assignment => formatDate(assignment.completedDate) },
  ]

  const certColumns: Column<Certification>[] = [
    { key: "personId", header: "Person", sortable: true, render: cert => personName(data, cert.personId) },
    { key: "certName", header: "Certification", sortable: true },
    { key: "uiPathCertCode", header: "Code", render: cert => <span className="font-mono text-xs">{cert.uiPathCertCode || "—"}</span> },
    { key: "status", header: "Status", sortable: true, render: cert => <StatusBadge status={cert.status} /> },
    { key: "expiryDate", header: "Expiry", sortable: true, sortValue: cert => cert.expiryDate ?? "", render: cert => formatDate(cert.expiryDate) },
    { key: "counts", header: "Counts toward", render: cert => {
      if (!isCertValid(data, cert)) return <Badge variant="muted">No</Badge>
      return <Badge variant={hasOverride(data, "Certification", cert.certificationId, "status") ? "warning" : "success"}>
        {hasOverride(data, "Certification", cert.certificationId, "status") ? "Yes (override)" : "Yes"}
      </Badge>
    } },
  ]

  return <div className="space-y-8">
    <PageHeader title="Courses" description="See which assigned courses employees have done, are doing, or will do. Planned work comes from workbook assignments." actions={<GlobalFilters />} />

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Completed assignments" value={training.completed} icon={CircleCheck} tone="success" sublabel={`${formatPercent(training.completionRate)} of assignments`} />
      <KpiCard label="Doing or planned" value={courses.reduce((sum, course) => sum + course.doing + course.planned, 0)} icon={GraduationCap} tone="services" />
      <KpiCard label="Needs attention" value={courses.reduce((sum, course) => sum + course.attention, 0)} icon={AlertTriangle} tone="warning" sublabel={`${training.overdue} overdue assignments`} />
      <KpiCard label="Valid certifications" value={certs.completed} icon={Award} tone="services" sublabel={`${certs.expiring} expiring soon`} />
    </section>

    <section className="space-y-3">
      <SectionHeading title="Course progress" tone="services" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {courses.length ? courses.map(course => <Card key={course.name} className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{course.name}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">{course.done}/{course.total} done</span>
          </div>
          <Progress value={course.total ? course.done / course.total : 0} tone="services" className="mt-3" />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Doing: {course.doing}</span><span>Will do: {course.planned}</span>
            <span>Needs attention: {course.attention}</span><span>Overdue: {course.overdue}</span>
          </div>
          <ul className="mt-4 space-y-1 border-t pt-3 text-sm">
            {course.employees.map((employee, index) => <li key={`${employee.name}:${index}`} className="flex justify-between gap-3">
              <span>{employee.name}</span><span className="text-muted-foreground">{stateLabels[employee.state]}</span>
            </li>)}
          </ul>
        </Card>) : <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">No course assignments for the selected filters.</p>}
      </div>
    </section>

    <section className="space-y-3">
      <SectionHeading title="Employee course assignments" tone="services" />
      <DataTable rows={data.trainingAssignments} columns={trainingColumns}
        searchKeys={assignment => `${personName(data, assignment.personId)} ${assignment.courseName} ${assignment.status}`}
        emptyMessage="No course assignments for the selected filters." />
    </section>

    <section className="space-y-3">
      <SectionHeading title="Certifications" tone="services" />
      <DataTable rows={data.certifications} columns={certColumns}
        searchKeys={cert => `${personName(data, cert.personId)} ${cert.certName} ${cert.uiPathCertCode}`}
        emptyMessage="No certifications for the selected filters." />
    </section>
  </div>
}
