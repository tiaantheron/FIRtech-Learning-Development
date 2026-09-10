import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { revenueMetrics } from "@/lib/calculations/metrics"
import { TrendChart } from "./charts"
import { Card } from "./ui/card"
export function RevenueHistory() {
  const data = useWorkbookData(false)
  const { filters } = useWorkbook()
  if (!data) return null
  const history = data.reportingPeriods.map(period => ({ name: period.name, Revenue: revenueMetrics(data, { ...filters, periodId: period.periodId }).attainedZAR }))
  return <Card className="p-5"><h2 className="font-semibold">Revenue history · ZAR</h2><p className="mb-4 text-sm text-muted-foreground">All workbook periods for the selected department. Targets remain workbook targets; they are not prorated.</p><TrendChart data={history} series={[{ key: "Revenue", name: "Recognized ZAR", color: "var(--resell)" }]} formatValue={v => `R${(v / 1000000).toFixed(1)}m`} /></Card>
}

