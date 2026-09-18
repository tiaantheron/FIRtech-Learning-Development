import type { TrainingAssignment, WorkbookData } from "@/lib/models/types"
import { daysUntil } from "@/lib/utils/format"
import { filterWorkbook } from "./filter"
import type { Filters } from "./metrics"

export type CourseState = "done" | "doing" | "planned" | "attention" | "excluded"

export function courseState(assignment: TrainingAssignment): CourseState {
  const status = assignment.status.toLowerCase()
  if (status === "completed" || status === "passed") return "done"
  if (status === "not allocated" || status === "allocated" || status === "not started") return "planned"
  if (status === "in progress" || status === "exam scheduled" || status === "awaiting result") return "doing"
  if (status === "waived" || status === "not applicable") return "excluded"
  return "attention"
}

export function isOutstandingCourse(assignment: TrainingAssignment) {
  return !["done", "excluded"].includes(courseState(assignment))
}

export function courseSummaries(data: WorkbookData, filters: Filters) {
  const assignments = filterWorkbook(data, filters).trainingAssignments
  const courses = new Map<string, {
    name: string; total: number; done: number; doing: number; planned: number;
    attention: number; overdue: number; employees: { name: string; state: CourseState; dueDate: string | null }[]
  }>()
  for (const assignment of assignments) {
    const name = assignment.courseName.trim() || "Unnamed course"
    const course = courses.get(name) ?? { name, total: 0, done: 0, doing: 0, planned: 0, attention: 0, overdue: 0, employees: [] }
    const state = courseState(assignment)
    if (state !== "excluded") {
      course.total++
      course[state]++
    }
    if (isOutstandingCourse(assignment) && (daysUntil(assignment.dueDate) ?? 0) < 0) course.overdue++
    course.employees.push({
      name: data.people.find(person => person.personId === assignment.personId)?.fullName ?? assignment.personId,
      state, dueDate: assignment.dueDate,
    })
    courses.set(name, course)
  }
  return [...courses.values()].sort((a, b) => a.name.localeCompare(b.name))
}
