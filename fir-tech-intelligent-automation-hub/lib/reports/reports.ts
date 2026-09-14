import type { WorkbookData } from "@/lib/models/types"
import type { ExportRow } from "@/lib/services/export"
import {
  type Filters,
  departmentName,
  departmentPerformance,
  engagementMetrics,
  getSetting,
  personName,
  pipelineMetrics,
  remainingValue,
  revenueMetrics,
  summarisePathway,
  trainingMetrics,
  weightedValue,
  isCertValid,
  effectiveProbability,
} from "@/lib/calculations/metrics"
import { daysUntil } from "@/lib/utils/format"
import { filterWorkbook } from "@/lib/calculations/filter"
import { conversionReport } from "@/lib/calculations/currency"
import { additionalReports } from "./additional-reports"

export interface ReportDef {
  id: string
  name: string
  description: string
  build: (data: WorkbookData, filters: Filters) => ExportRow[]
}

const definitions: ReportDef[] = [
  {
    id: "executive-readiness",
    name: "Executive Readiness Report",
    description: "Top-line partner readiness across both pathways plus revenue and risk.",
    build: (data, filters) => {
      const resell = summarisePathway(data.resellRequirements, getSetting(data, "ResellCurrentLevel"), getSetting(data, "ResellTargetLevel"))
      const services = summarisePathway(data.servicesRequirements, getSetting(data, "ServicesCurrentLevel"), getSetting(data, "ServicesTargetLevel"))
      const rev = revenueMetrics(data, filters)
      const training = trainingMetrics(data, filters)
      const eng = engagementMetrics(data, filters)
      return [
        { Metric: "Resell readiness", Value: pct(resell.progress), Detail: `${resell.achieved}/${resell.total} achieved` },
        { Metric: "Services readiness", Value: pct(services.progress), Detail: `${services.achieved}/${services.total} achieved` },
        { Metric: "Revenue attainment (ZAR)", Value: pct(rev.attainmentPct), Detail: `${money(rev.attainedZAR)} of ${money(rev.targetZAR)}` },
        { Metric: "Recorded revenue (USD)", Value: money(rev.attainedUSD, "USD"), Detail: "Tracked separately" },
        { Metric: "Training completion", Value: pct(training.completionRate), Detail: `${training.outstanding} outstanding` },
        { Metric: "Qualifying engagements", Value: eng.qualifying, Detail: `${eng.uniqueProfessionalServices} unique PS` },
      ]
    },
  },
  {
    id: "resell-gap",
    name: "Resell Gap Report",
    description: "Outstanding Resell requirements and remaining values.",
    build: (data) => requirementRows(data.resellRequirements.filter(r => r.status === "Outstanding")),
  },
  {
    id: "services-gap",
    name: "Services Gap Report",
    description: "Outstanding Services requirements and remaining values.",
    build: (data) => requirementRows(data.servicesRequirements.filter(r => r.status === "Outstanding")),
  },
  {
    id: "department-performance",
    name: "Department Performance Report",
    description: "Revenue, pipeline and certification contribution by department.",
    build: (data) =>
      departmentPerformance(data).map((p) => ({
        Department: p.name,
        Head: p.head,
        "Revenue Target (ZAR)": p.revenueTargetZAR,
        "Revenue Attained (ZAR)": p.revenueAttainedZAR,
        "Revenue %": pct(p.revenuePct),
        "Weighted Pipeline (ZAR)": Math.round(p.weightedPipeline),
        Leads: p.leadCount,
        Opportunities: p.opportunityCount,
        "Valid Certs": p.validCertifications,
      })),
  },
  {
    id: "revenue-performance",
    name: "Revenue Performance Report",
    description: "Revenue records with attribution, kept per-currency.",
    build: (data, filters) =>
      filterByDept(data.revenue, filters, (r) => r.ownerDepartmentId).map((r) => ({
        Customer: r.customer,
        Type: r.type,
        Amount: r.amount,
        ...conversionReport(r, r.amount),
        Currency: r.currency,
        "Owner (counted)": departmentName(data, r.ownerDepartmentId),
        "Lead Origin": departmentName(data, r.leadOriginDepartmentId),
        Influencing: r.influencingDepartmentId ? departmentName(data, r.influencingDepartmentId) : "",
        Delivering: departmentName(data, r.deliveringDepartmentId),
        Recognized: r.recognizedDate ?? "",
      })),
  },
  {
    id: "pipeline",
    name: "Pipeline Report",
    description: "Opportunities with weighted values and stages.",
    build: (data, filters) => {
      const pipe = pipelineMetrics(data, filters)
      const rows: ExportRow[] = filterByDept(data.opportunities, filters, (o) => o.departmentId).map((o) => ({
        Opportunity: o.name,
        Customer: o.customer,
        Owner: personName(data, o.owner),
        Department: departmentName(data, o.departmentId),
        Value: o.estimatedValue,
        ...conversionReport(o, o.estimatedValue),
        Currency: o.currency,
        "Probability %": Math.round(effectiveProbability(o) * 100),
        Weighted: Math.round(weightedValue(o)),
        Stage: o.stage,
        Close: o.closeDate ?? "",
      }))
      for (const currency of ["ZAR", "USD"] as const) { const pipe = pipelineMetrics(data, filters, currency); rows.push({
        Opportunity: "TOTAL",
        Customer: "",
        Owner: "",
        Department: "",
        Value: pipe.totalPipeline,
        Currency: currency,
        "Probability %": "",
        Weighted: Math.round(pipe.weightedPipeline),
        Stage: `Closed opportunity win rate ${pct(pipe.conversionRate)}`,
        Close: "",
      }) }
      return rows
    },
  },
  {
    id: "training-outstanding",
    name: "Training Outstanding Report",
    description: "All incomplete training assignments with due dates.",
    build: (data) => {
      const OUTSTANDING = new Set(["Not Allocated", "Allocated", "Not Started", "In Progress", "Exam Scheduled", "Awaiting Result", "Failed", "Expired"])
      return data.trainingAssignments
        .filter((t) => OUTSTANDING.has(t.status))
        .map((t) => {
          const d = daysUntil(t.dueDate)
          return {
            Person: personName(data, t.personId),
            Course: t.courseName,
            Status: t.status,
            Due: t.dueDate ?? "",
            "Days To Due": d ?? "",
            Overdue: d !== null && d < 0 ? "Yes" : "No",
          }
        })
    },
  },
  {
    id: "certification",
    name: "Certification Report",
    description: "Certification inventory with validity and expiry.",
    build: (data) =>
      data.certifications.map((c) => ({
        Person: personName(data, c.personId),
        Certification: c.certName,
        Code: c.uiPathCertCode,
        Status: c.status,
        Issued: c.issueDate ?? "",
        Expiry: c.expiryDate ?? "",
        "Counts Toward Attainment": isCertValid(data, c) ? "Yes" : "No",
      })),
  },
  {
    id: "engagement",
    name: "Engagement Report",
    description: "Engagement inventory with categories and qualification.",
    build: (data) =>
      data.engagements.map((e) => ({
        Customer: e.customer,
        Engagement: e.name,
        Category: e.type,
        Qualification: e.qualificationStatus,
        "Contract Value": e.contractValue,
        ...conversionReport(e, e.contractValue),
        Currency: e.currency,
        NPS: e.npsStatus,
        CSAT: e.csatStatus,
        Date: e.date ?? "",
      })),
  },
]

export const REPORTS: ReportDef[] = [...definitions, ...additionalReports(definitions)].map(report => ({ ...report, build: (data, filters) => report.build(filterWorkbook(data, filters), filters) }))

function requirementRows(reqs: WorkbookData["resellRequirements"]): ExportRow[] {
  return reqs.map((r) => ({
    Requirement: r.requirement,
    Required: r.requiredValue,
    Attained: r.attainedValue,
    Remaining: remainingValue(r),
    Unit: r.unit,
    Owner: r.owner,
    Due: r.dueDate ?? "",
    Status: r.status,
  }))
}

function filterByDept<T>(rows: T[], filters: Filters, getDept: (r: T) => string): T[] {
  if (filters.departmentId === "all") return rows
  return rows.filter((r) => getDept(r) === filters.departmentId)
}

function pct(v: number): string {
  return `${Math.round((v || 0) * 100)}%`
}
function money(v: number, currency = "ZAR"): string {
  return `${currency} ${Math.round(v || 0).toLocaleString()}`
}
