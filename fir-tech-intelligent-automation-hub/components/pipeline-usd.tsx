import { pipelineMetrics, type Filters } from "@/lib/calculations/metrics"
import type { WorkbookData } from "@/lib/models/types"
import { formatCurrency } from "@/lib/utils/format"
export function PipelineUSD({ data, filters }: { data: WorkbookData; filters: Filters }) {
  const p = pipelineMetrics(data, filters, "USD")
  return <div className="rounded-lg border border-border bg-card p-4 text-sm"><p className="mb-2 font-semibold">UiPath pipeline · USD</p><div className="flex flex-wrap gap-x-8 gap-y-2"><span>Open: {formatCurrency(p.totalPipeline, "USD")}</span><span>Weighted: {formatCurrency(p.weightedPipeline, "USD")}</span><span>Won: {formatCurrency(p.wonRevenue, "USD")}</span><span>Lost: {formatCurrency(p.lostRevenue, "USD")}</span></div></div>
}

