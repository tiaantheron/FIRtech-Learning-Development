
import { PipelineUSD } from "@/components/pipeline-usd"
import { RevenueHistory } from "@/components/revenue-history"

import {
  Award,
  Banknote,
  GraduationCap,
  Target,
  Handshake,
  ShieldAlert,
  TrendingUp,
} from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { KpiCard } from "@/components/kpi-card"
import { PathwayCard } from "@/components/pathway-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DonutChart } from "@/components/charts"
import {
  certMetrics,
  engagementMetrics,
  getSetting,
  pipelineMetrics,
  revenueMetrics,
  riskMetrics,
  summarisePathway,
  trainingMetrics,
} from "@/lib/calculations/metrics"
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format"

export default function OverviewPage() {
  const { filters } = useWorkbook()
  const data = useWorkbookData()

  if (!data) {
    return <p className="text-sm text-muted-foreground">No workbook data available. Upload a workbook to begin.</p>
  }

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

  const rev = revenueMetrics(data, filters)
  const training = trainingMetrics(data, filters)
  const certs = certMetrics(data, filters)
  const pipe = pipelineMetrics(data, filters)
  const eng = engagementMetrics(data, filters)
  const risk = riskMetrics(data, filters)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Executive Overview"
        description={`Partner readiness for ${getSetting(data, "CompanyName", "FIRtech")} · ${getSetting(data, "FiscalYear", "")}`}
        actions={<GlobalFilters />}
      />
      <p className="text-sm text-muted-foreground">UiPath source refreshed: {getSetting(data, "SourceRefreshDate", "Not supplied in workbook")}. Source status: {getSetting(data, "DataStatus", "Not specified")}.</p>

      {/* Pathways */}
      <section className="space-y-3">
        <SectionHeading title="Partner Pathways" />
        <div className="grid gap-4 lg:grid-cols-2">
          <PathwayCard title="Resell · Diamond" summary={resell} tone="resell" />
          <PathwayCard title="Services · Gold" summary={services} tone="services" />
        </div>
      </section>

      {/* Revenue */}
      <section className="space-y-3">
        <SectionHeading title="Revenue" tone="resell" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Revenue Target (ZAR)" value={formatCurrency(rev.targetZAR, "ZAR")} icon={Target} />
          <KpiCard label="Revenue Attained (ZAR)" value={formatCurrency(rev.attainedZAR, "ZAR")} icon={Banknote} tone="success" />
          <KpiCard label="Revenue Remaining (ZAR)" value={formatCurrency(rev.remainingZAR, "ZAR")} icon={TrendingUp} tone="warning" />
          <KpiCard
            label="Attainment"
            value={formatPercent(rev.attainmentPct)}
            sublabel={`Recorded revenue (USD) ${formatCurrency(rev.attainedUSD, "USD")}`}
            icon={Award}
            tone="resell"
          />
        </div>
        <Card className="p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">ZAR attainment</span>
            <span className="tabular-nums text-muted-foreground">
              {formatCurrency(rev.attainedZAR)} / {formatCurrency(rev.targetZAR)}
            </span>
          </div>
          <Progress value={rev.attainmentPct} tone="resell" className="mt-3 h-3" />
        </Card>
      </section>

      {/* Training + Pipeline + Engagements grid */}
      <section className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3">
          <SectionHeading title="Training" tone="services" />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-[var(--services)]" /> Certification status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                data={[
                  { name: "Completed", value: certs.completed, color: "var(--success)" },
                  { name: "In progress", value: certs.inProgress, color: "var(--services)" },
                  { name: "Expired", value: certs.expired, color: "var(--destructive)" },
                ]}
              />
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Stat label="Outstanding training" value={training.outstanding} />
                <Stat label="Outstanding certs" value={certs.outstanding} />
                <Stat label="Completed certs" value={certs.completed} />
                <Stat label="Expiring (≤60d)" value={certs.expiring} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <SectionHeading title="Pipeline" tone="resell" />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[var(--resell)]" /> Sales pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Leads identified" value={pipe.leads} />
                <Stat label="Open opportunities" value={pipe.openOpportunities} />
                <Stat label="Total pipeline" value={formatCurrency(pipe.totalPipeline)} />
                <Stat label="Weighted pipeline" value={formatCurrency(pipe.weightedPipeline)} />
                <Stat label="Won opportunity value" value={formatCurrency(pipe.wonRevenue)} />
                <Stat label="Closed opportunity win rate" value={formatPercent(pipe.conversionRate)} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <SectionHeading title="Engagements" tone="services" />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-[var(--services)]" /> Engagement mix
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Total engagements" value={eng.total} />
                <Stat label="Qualifying" value={eng.qualifying} />
                <Stat label="Customer (resell)" value={eng.customer} />
                <Stat label="Professional services" value={eng.professionalServices} />
                <Stat label="Unique PS" value={eng.uniqueProfessionalServices} />
                <Stat label="Non-qualifying" value={eng.nonQualifying} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Risk */}
      <PipelineUSD data={data} filters={filters} />
      <RevenueHistory />
      <section className="space-y-3">
        <SectionHeading title="Risk" />
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Requirements at risk" value={risk.requirementsAtRisk} icon={ShieldAlert} tone="danger" sublabel="Outstanding & due within 45 days" />
          <KpiCard label="Overdue training" value={risk.overdueTraining} icon={GraduationCap} tone="danger" />
          <KpiCard label="Overdue certifications" value={risk.overdueCertifications} icon={Award} tone="danger" />
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {formatNumber(data.people.length)} people · {data.departments.length} departments · figures reflect the selected
        reporting period and department filters. UiPath USD and internal ZAR values are tracked separately.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
