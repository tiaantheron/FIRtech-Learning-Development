import type { ReportDef } from "./reports"
import { isCertValid, personName, departmentName, pipelineMetrics } from "@/lib/calculations/metrics"
import { daysUntil } from "@/lib/utils/format"

export function additionalReports(base: ReportDef[]): ReportDef[] {
  const certification = base.find(r => r.id === "certification")!
  const training = base.find(r => r.id === "training-outstanding")!
  return [
    { id: "certifications-outstanding", name: "Certifications Outstanding", description: "Unattained certifications, excluding waived and not applicable records.", build: (data, filters) => certification.build({ ...data, certifications: data.certifications.filter(c => !isCertValid(data, c) && !["Waived", "Not Applicable"].includes(c.status)) }, filters) },
    { id: "certifications-completed", name: "Certifications Completed", description: "Currently valid certifications, including explicit recognition overrides.", build: (data, filters) => certification.build({ ...data, certifications: data.certifications.filter(c => isCertValid(data, c)) }, filters) },
    { id: "certifications-expiring", name: "Expiring Certifications", description: "Valid certifications expiring in the next 60 days.", build: (data, filters) => certification.build({ ...data, certifications: data.certifications.filter(c => { const days = daysUntil(c.expiryDate); return isCertValid(data, c) && days !== null && days >= 0 && days <= 60 }) }, filters) },
    { id: "assignments-overdue", name: "Overdue Assignments", description: "Outstanding training whose due date has passed.", build: (data, filters) => training.build(data, filters).filter(r => r.Overdue === "Yes") },
    { id: "nps-csat", name: "NPS & CSAT Status", description: "Recorded feedback statuses; blank values are shown as not recorded.", build: data => data.engagements.map(e => ({ Customer: e.customer, Engagement: e.name, Department: departmentName(data, e.departmentId ?? ""), Qualification: e.qualificationStatus, NPS: e.npsStatus || "Not recorded", CSAT: e.csatStatus || "Not recorded" })) },
    { id: "pipeline-department", name: "Pipeline by Department", description: "Open ZAR pipeline and weighted pipeline, including documented conversions.", build: data => data.departments.map(d => { const p = pipelineMetrics(data, { departmentId: d.departmentId, periodId: "all" }); return { Department: d.name, "Open Opportunities": p.openOpportunities, "Pipeline ZAR": p.totalPipeline, "Weighted ZAR": p.weightedPipeline, "Won ZAR": p.wonRevenue, "Lost ZAR": p.lostRevenue } }) },
    { id: "pipeline-owner", name: "Pipeline by Owner", description: "Owner-level ZAR values and closed opportunity win rate.", build: data => [...new Set(data.opportunities.map(o => o.owner))].map(owner => { const p = pipelineMetrics({ ...data, opportunities: data.opportunities.filter(o => o.owner === owner) }); return { Owner: personName(data, owner), "Open Opportunities": p.openOpportunities, "Pipeline ZAR": p.totalPipeline, "Weighted ZAR": p.weightedPipeline, "Won ZAR": p.wonRevenue, "Lost ZAR": p.lostRevenue, "Closed Opportunity Win Rate": `${Math.round(p.conversionRate * 100)}%` } }) },
    { id: "leads-department", name: "Leads by Department", description: "Identified lead inventory by owning department.", build: data => data.departments.map(d => ({ Department: d.name, "Leads Identified": data.leads.filter(l => l.departmentId === d.departmentId).length })) },
  ]
}
