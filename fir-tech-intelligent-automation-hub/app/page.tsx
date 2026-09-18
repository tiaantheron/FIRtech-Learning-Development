import { Link } from "react-router-dom"
import { Award, Banknote, GraduationCap, ShieldAlert, Target, TrendingUp } from "lucide-react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { GlobalFilters } from "@/components/global-filters"
import { KpiCard } from "@/components/kpi-card"
import { PathwayCard } from "@/components/pathway-card"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { MonetaryConfiguration } from "@/components/monetary-configuration"
import { isOutstandingCourse } from "@/lib/calculations/courses"
import { originalCurrencyTotals } from "@/lib/calculations/currency"
import { certMetrics, getSetting, personName, revenueMetrics, riskMetrics, summarisePathway, trainingMetrics } from "@/lib/calculations/metrics"
import { daysUntil, formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/utils/format"

export default function OverviewPage() {
  const { filters, displayCurrency } = useWorkbook()
  const data = useWorkbookData()
  if (!data) return <p className="text-sm text-muted-foreground">No workbook data available. Upload a workbook to begin.</p>

  const resell = summarisePathway(data.resellRequirements, getSetting(data, "ResellCurrentLevel", "—"), getSetting(data, "ResellTargetLevel", "Diamond"))
  const services = summarisePathway(data.servicesRequirements, getSetting(data, "ServicesCurrentLevel", "—"), getSetting(data, "ServicesTargetLevel", "Gold"))
  const revenue = revenueMetrics(data, filters)
  const originalRevenue = originalCurrencyTotals(data.revenue, record => record.amount)
  const usdTarget = data.overview.find(setting => setting.key === "CompanyRevenueTargetUSD")?.value
  const training = trainingMetrics(data, filters)
  const certs = certMetrics(data, filters)
  const risk = riskMetrics(data, filters)
  const outstanding = data.trainingAssignments
    .filter(isOutstandingCourse)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 6)

  return <div className="space-y-8">
    <PageHeader title="Executive Overview"
      description={`Partner readiness for ${getSetting(data, "CompanyName", "FIRtech")} · ${getSetting(data, "FiscalYear", "")}`}
      actions={<GlobalFilters currency />} />
    <p className="text-sm text-muted-foreground">UiPath source refreshed: {getSetting(data, "SourceRefreshDate", "Not supplied in workbook")}. Source status: {getSetting(data, "DataStatus", "Not specified")}.</p>

    <section className="space-y-3">
      <SectionHeading title="Partner Pathways" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PathwayCard title="Resell · Diamond" summary={resell} tone="resell" />
        <PathwayCard title="Services · Gold" summary={services} tone="services" />
      </div>
    </section>

    <section className="space-y-3">
      <SectionHeading title={displayCurrency === "source" ? "Revenue · original currencies" : "Revenue · Rand"} tone="resell" />
      {displayCurrency === "source" ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Company target (ZAR)" value={formatCurrency(revenue.targetZAR)} icon={Target} />
        {usdTarget !== undefined && usdTarget !== "" && <KpiCard label="Company target (USD)" value={formatCurrency(Number(usdTarget), "USD")} icon={Target} />}
        {originalRevenue.length ? originalRevenue.map(total => <KpiCard key={total.currency} label={`Recorded (${total.currency})`} value={formatCurrency(total.value, total.currency)} icon={Banknote} tone="success" />)
          : <KpiCard label="Recorded revenue" value="No records" icon={Banknote} />}
      </div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Target (ZAR)" value={formatCurrency(revenue.targetZAR)} icon={Target} />
        <KpiCard label="Attained (ZAR)" value={formatCurrency(revenue.attainedZAR)} icon={Banknote} tone="success" />
        <KpiCard label="Remaining (ZAR)" value={formatCurrency(revenue.remainingZAR)} icon={TrendingUp} tone="warning" />
        <KpiCard label="Attainment" value={formatPercent(revenue.attainmentPct)} icon={Award} tone="resell" />
      </div>}
      {displayCurrency === "ZAR" && revenue.targetZAR > 0 && <Card className="p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">ZAR attainment</span>
          <span className="tabular-nums text-muted-foreground">{formatCurrency(revenue.attainedZAR)} / {formatCurrency(revenue.targetZAR)}</span>
        </div>
        <Progress value={revenue.attainmentPct} tone="resell" className="mt-3 h-3" />
      </Card>}
      {displayCurrency === "source" && <p className="text-xs text-muted-foreground">Source amounts stay in their original currencies; different currencies are never added together. Select All in Rand for comparable totals where an exchange rate is recorded.</p>}
    </section>
    <MonetaryConfiguration />

    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading title="Outstanding training" tone="services" />
        <Link to="/courses" className="text-sm font-medium text-primary underline">View all courses</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Outstanding assignments" value={training.outstanding} icon={GraduationCap} tone="warning" />
        <KpiCard label="Overdue training" value={training.overdue} icon={ShieldAlert} tone="danger" />
        <KpiCard label="Completed courses" value={training.completed} icon={GraduationCap} tone="success" />
        <KpiCard label="Valid certifications" value={certs.completed} sublabel={`${certs.expiring} expiring soon`} icon={Award} tone="services" />
      </div>
      <Card className="divide-y">
        {outstanding.length ? outstanding.map(assignment => {
          const overdue = (daysUntil(assignment.dueDate) ?? 0) < 0
          return <div key={assignment.assignmentId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <div><p className="font-medium">{assignment.courseName}</p><p className="text-muted-foreground">{personName(data, assignment.personId)} · {assignment.status}</p></div>
            <span className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>{overdue ? "Overdue · " : "Due "}{formatDate(assignment.dueDate)}</span>
          </div>
        }) : <p className="px-5 py-6 text-sm text-muted-foreground">No outstanding course assignments for the selected filters.</p>}
      </Card>
    </section>

    <section className="space-y-3">
      <SectionHeading title="Risk" />
      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard label="Requirements at risk" value={risk.requirementsAtRisk} icon={ShieldAlert} tone="danger" sublabel="Outstanding & due within 45 days" />
        <KpiCard label="Overdue certifications" value={risk.overdueCertifications} icon={Award} tone="danger" />
      </div>
    </section>
    <p className="text-xs text-muted-foreground">{formatNumber(data.people.length)} people · {data.departments.length} departments · figures reflect the selected reporting period and department filters.</p>
  </div>
}
