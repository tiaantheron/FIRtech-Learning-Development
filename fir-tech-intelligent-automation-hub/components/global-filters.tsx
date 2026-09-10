

import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { Select } from "@/components/ui/select"

export function GlobalFilters() {
  const { filters, setFilters } = useWorkbook()
  const data = useWorkbookData(false)
  if (!data) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="period-filter">
        Reporting period
      </label>
      <Select
        id="period-filter"
        value={filters.periodId}
        onChange={(e) => setFilters({ ...filters, periodId: e.target.value })}
      >
        <option value="all">All periods</option>
        {data.reportingPeriods.map((p) => (
          <option key={p.periodId} value={p.periodId}>
            {p.name}
            {p.active ? " (current)" : ""}
          </option>
        ))}
      </Select>

      <label className="sr-only" htmlFor="dept-filter">
        Department
      </label>
      <Select
        id="dept-filter"
        value={filters.departmentId}
        onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
      >
        <option value="all">All departments</option>
        {data.departments.map((d) => (
          <option key={d.departmentId} value={d.departmentId}>
            {d.name}
          </option>
        ))}
      </Select>
    </div>
  )
}

