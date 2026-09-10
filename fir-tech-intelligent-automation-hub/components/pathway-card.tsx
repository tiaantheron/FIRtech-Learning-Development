import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { formatPercent } from "@/lib/utils/format"
import type { PathwaySummary } from "@/lib/calculations/metrics"

export function PathwayCard({
  title,
  summary,
  tone,
}: {
  title: string
  summary: PathwaySummary
  tone: "resell" | "services"
}) {
  const badgeVariant = tone
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-4 w-1.5 rounded-full ${tone === "resell" ? "bg-[var(--resell)]" : "bg-[var(--services)]"}`}
              aria-hidden
            />
            <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.currentLevel} <span aria-hidden>→</span> targeting{" "}
            <span className="font-medium text-foreground">{summary.targetLevel}</span>
          </p>
        </div>
        <Badge variant={badgeVariant}>{formatPercent(summary.progress)} ready</Badge>
      </div>

      <div className="mt-4">
        <Progress value={summary.progress} tone={tone} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md bg-muted/60 py-2">
          <dt className="text-xs text-muted-foreground">Achieved</dt>
          <dd className="text-lg font-semibold text-[var(--success)]">{summary.achieved}</dd>
        </div>
        <div className="rounded-md bg-muted/60 py-2">
          <dt className="text-xs text-muted-foreground">Maintain</dt>
          <dd className="text-lg font-semibold text-primary">{summary.maintain}</dd>
        </div>
        <div className="rounded-md bg-muted/60 py-2">
          <dt className="text-xs text-muted-foreground">Outstanding</dt>
          <dd className="text-lg font-semibold text-[oklch(0.5_0.13_75)]">{summary.outstanding}</dd>
        </div>
      </dl>
    </Card>
  )
}
