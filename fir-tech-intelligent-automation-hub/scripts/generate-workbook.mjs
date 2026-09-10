import * as XLSX from "xlsx"
import { writeFileSync, mkdirSync } from "node:fs"

const wb = XLSX.utils.book_new()
const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)

add("Overview", [
  { Key: "CompanyName", Value: "FIRtech" },
  { Key: "ResellCurrentLevel", Value: "Gold" },
  { Key: "ResellTargetLevel", Value: "Diamond" },
  { Key: "ServicesCurrentLevel", Value: "Silver" },
  { Key: "ServicesTargetLevel", Value: "Gold" },
  { Key: "CompanyRevenueTargetZAR", Value: "48000000" },
  { Key: "CompanyRevenueTargetUSD", Value: "2600000" },
  { Key: "FiscalYear", Value: "FY2026" },
])

add("Departments", [
  { DepartmentId: "DEP-SALES", Name: "Sales", Head: "Naledi Khumalo", RevenueAllocationPct: 40, RevenueTargetZAR: 19200000, LeadTarget: 120, OpportunityTarget: 60 },
  { DepartmentId: "DEP-PS", Name: "Professional Services", Head: "Johan van der Merwe", RevenueAllocationPct: 30, RevenueTargetZAR: 14400000, LeadTarget: 40, OpportunityTarget: 30 },
  { DepartmentId: "DEP-PRESALES", Name: "Presales", Head: "Aisha Patel", RevenueAllocationPct: 15, RevenueTargetZAR: 7200000, LeadTarget: 60, OpportunityTarget: 40 },
  { DepartmentId: "DEP-DELIVERY", Name: "Delivery", Head: "Thabo Mokoena", RevenueAllocationPct: 15, RevenueTargetZAR: 7200000, LeadTarget: 20, OpportunityTarget: 15 },
])

add("People", [
  { PersonId: "P-001", FullName: "Naledi Khumalo", JobTitle: "Head of Sales", PrimaryDepartmentId: "DEP-SALES", SecondaryDepartmentIds: "", ManagerId: "", EmploymentStatus: "Active", UiPathId: "UI-1001" },
  { PersonId: "P-002", FullName: "Johan van der Merwe", JobTitle: "PS Director", PrimaryDepartmentId: "DEP-PS", SecondaryDepartmentIds: "DEP-DELIVERY", ManagerId: "", EmploymentStatus: "Active", UiPathId: "UI-1002" },
  { PersonId: "P-003", FullName: "Aisha Patel", JobTitle: "Presales Lead", PrimaryDepartmentId: "DEP-PRESALES", SecondaryDepartmentIds: "DEP-SALES", ManagerId: "P-001", EmploymentStatus: "Active", UiPathId: "UI-1003" },
  { PersonId: "P-004", FullName: "Thabo Mokoena", JobTitle: "Delivery Manager", PrimaryDepartmentId: "DEP-DELIVERY", SecondaryDepartmentIds: "", ManagerId: "P-002", EmploymentStatus: "Active", UiPathId: "UI-1004" },
  { PersonId: "P-005", FullName: "Sarah Nkosi", JobTitle: "RPA Developer", PrimaryDepartmentId: "DEP-PS", SecondaryDepartmentIds: "", ManagerId: "P-002", EmploymentStatus: "Active", UiPathId: "UI-1005" },
  { PersonId: "P-006", FullName: "Daniel Botha", JobTitle: "Solutions Architect", PrimaryDepartmentId: "DEP-PRESALES", SecondaryDepartmentIds: "DEP-PS", ManagerId: "P-003", EmploymentStatus: "Active", UiPathId: "UI-1006" },
  { PersonId: "P-007", FullName: "Lerato Dlamini", JobTitle: "Account Executive", PrimaryDepartmentId: "DEP-SALES", SecondaryDepartmentIds: "", ManagerId: "P-001", EmploymentStatus: "Active", UiPathId: "UI-1007" },
  { PersonId: "P-008", FullName: "Michael Adams", JobTitle: "RPA Developer", PrimaryDepartmentId: "DEP-PS", SecondaryDepartmentIds: "", ManagerId: "P-002", EmploymentStatus: "Active", UiPathId: "UI-1008" },
  { PersonId: "P-009", FullName: "Zanele Mahlangu", JobTitle: "Business Analyst", PrimaryDepartmentId: "DEP-DELIVERY", SecondaryDepartmentIds: "DEP-PS", ManagerId: "P-004", EmploymentStatus: "Active", UiPathId: "UI-1009" },
  { PersonId: "P-010", FullName: "Pieter Steyn", JobTitle: "Account Executive", PrimaryDepartmentId: "DEP-SALES", SecondaryDepartmentIds: "", ManagerId: "P-001", EmploymentStatus: "On Leave", UiPathId: "UI-1010" },
])

add("DepartmentMemberships", [
  { MembershipId: "M-01", PersonId: "P-001", DepartmentId: "DEP-SALES", Role: "Head", IsPrimary: "TRUE" },
  { MembershipId: "M-02", PersonId: "P-002", DepartmentId: "DEP-PS", Role: "Director", IsPrimary: "TRUE" },
  { MembershipId: "M-03", PersonId: "P-002", DepartmentId: "DEP-DELIVERY", Role: "Advisor", IsPrimary: "FALSE" },
  { MembershipId: "M-04", PersonId: "P-003", DepartmentId: "DEP-PRESALES", Role: "Lead", IsPrimary: "TRUE" },
  { MembershipId: "M-05", PersonId: "P-003", DepartmentId: "DEP-SALES", Role: "Support", IsPrimary: "FALSE" },
  { MembershipId: "M-06", PersonId: "P-006", DepartmentId: "DEP-PRESALES", Role: "Architect", IsPrimary: "TRUE" },
  { MembershipId: "M-07", PersonId: "P-006", DepartmentId: "DEP-PS", Role: "Contributor", IsPrimary: "FALSE" },
])

const cs = [
  ["TA-01", "P-005", "UiPath Automation Developer Associate", "Completed", "2025-01-10", "2025-03-01", "2025-02-20"],
  ["TA-02", "P-005", "UiPath Advanced Developer", "In Progress", "2025-06-01", "2026-01-30", ""],
  ["TA-03", "P-006", "UiPath Solution Architect", "Exam Scheduled", "2025-07-15", "2026-02-15", ""],
  ["TA-04", "P-008", "UiPath Automation Developer Associate", "Completed", "2025-02-01", "2025-04-01", "2025-03-25"],
  ["TA-05", "P-008", "UiPath Advanced Developer", "Not Started", "2025-09-01", "2026-03-30", ""],
  ["TA-06", "P-009", "UiPath Business Analyst", "Allocated", "2025-08-01", "2026-04-30", ""],
  ["TA-07", "P-003", "UiPath Sales Professional", "Completed", "2025-01-05", "2025-02-01", "2025-01-28"],
  ["TA-08", "P-007", "UiPath Sales Professional", "Failed", "2025-03-01", "2025-04-15", ""],
  ["TA-09", "P-004", "UiPath Delivery Manager", "Awaiting Result", "2025-05-01", "2025-12-01", ""],
  ["TA-10", "P-010", "UiPath Sales Professional", "Not Allocated", "", "2025-11-01", ""],
]
add("TrainingAssignments", cs.map(([AssignmentId, PersonId, CourseName, Status, AssignedDate, DueDate, CompletedDate]) => ({ AssignmentId, PersonId, CourseName, Status, AssignedDate, DueDate, CompletedDate })))

add("Certifications", [
  { CertificationId: "C-01", PersonId: "P-005", CertName: "Automation Developer Associate", Status: "Active", IssueDate: "2025-02-20", ExpiryDate: "2027-02-20", UiPathCertCode: "UiADAv1" },
  { CertificationId: "C-02", PersonId: "P-008", CertName: "Automation Developer Associate", Status: "Active", IssueDate: "2025-03-25", ExpiryDate: "2027-03-25", UiPathCertCode: "UiADAv1" },
  { CertificationId: "C-03", PersonId: "P-006", CertName: "Solution Architect", Status: "In Progress", IssueDate: "", ExpiryDate: "", UiPathCertCode: "UiSAv1" },
  { CertificationId: "C-04", PersonId: "P-003", CertName: "Sales Professional", Status: "Active", IssueDate: "2025-01-28", ExpiryDate: "2026-10-30", UiPathCertCode: "UiSPv1" },
  { CertificationId: "C-05", PersonId: "P-002", CertName: "Automation Developer Professional", Status: "Expired", IssueDate: "2022-05-01", ExpiryDate: "2024-05-01", UiPathCertCode: "UiADPv1" },
  { CertificationId: "C-06", PersonId: "P-004", CertName: "Delivery Manager", Status: "Passed", IssueDate: "2025-06-01", ExpiryDate: "2027-06-01", UiPathCertCode: "UiDMv1" },
  { CertificationId: "C-07", PersonId: "P-001", CertName: "Sales Professional", Status: "Active", IssueDate: "2024-11-15", ExpiryDate: "2026-11-15", UiPathCertCode: "UiSPv1" },
])

add("Leads", [
  { LeadId: "L-01", Customer: "Nedbank", Owner: "P-007", DepartmentId: "DEP-SALES", EstimatedValue: 1800000, Currency: "ZAR", Source: "Referral", Status: "Qualified", CreatedDate: "2025-07-01" },
  { LeadId: "L-02", Customer: "Discovery", Owner: "P-010", DepartmentId: "DEP-SALES", EstimatedValue: 2400000, Currency: "ZAR", Source: "Event", Status: "New", CreatedDate: "2025-08-10" },
  { LeadId: "L-03", Customer: "Sasol", Owner: "P-003", DepartmentId: "DEP-PRESALES", EstimatedValue: 3200000, Currency: "ZAR", Source: "Inbound", Status: "Qualified", CreatedDate: "2025-06-20" },
  { LeadId: "L-04", Customer: "MTN", Owner: "P-007", DepartmentId: "DEP-SALES", EstimatedValue: 1500000, Currency: "ZAR", Source: "Outbound", Status: "Nurturing", CreatedDate: "2025-09-01" },
  { LeadId: "L-05", Customer: "Old Mutual", Owner: "P-002", DepartmentId: "DEP-PS", EstimatedValue: 2100000, Currency: "ZAR", Source: "Referral", Status: "Qualified", CreatedDate: "2025-05-15" },
])

add("Opportunities", [
  { OpportunityId: "O-01", Customer: "Nedbank", Name: "AP Automation Rollout", Owner: "P-007", DepartmentId: "DEP-SALES", EstimatedValue: 3600000, Currency: "ZAR", Probability: 70, Stage: "Proposal", CloseDate: "2025-12-15" },
  { OpportunityId: "O-02", Customer: "Discovery", Name: "Claims Bot Programme", Owner: "P-010", DepartmentId: "DEP-SALES", EstimatedValue: 5200000, Currency: "ZAR", Probability: 40, Stage: "Qualification", CloseDate: "2026-02-28" },
  { OpportunityId: "O-03", Customer: "Sasol", Name: "Finance Shared Services", Owner: "P-003", DepartmentId: "DEP-PRESALES", EstimatedValue: 4100000, Currency: "ZAR", Probability: 100, Stage: "Closed Won", CloseDate: "2025-08-30" },
  { OpportunityId: "O-04", Customer: "MTN", Name: "Network Ops Automation", Owner: "P-007", DepartmentId: "DEP-SALES", EstimatedValue: 2800000, Currency: "ZAR", Probability: 0, Stage: "Closed Lost", CloseDate: "2025-07-20" },
  { OpportunityId: "O-05", Customer: "Old Mutual", Name: "Policy Servicing PS", Owner: "P-002", DepartmentId: "DEP-PS", EstimatedValue: 3900000, Currency: "ZAR", Probability: 60, Stage: "Negotiation", CloseDate: "2026-01-31" },
  { OpportunityId: "O-06", Customer: "Standard Bank", Name: "KYC Automation", Owner: "P-002", DepartmentId: "DEP-PS", EstimatedValue: 6100000, Currency: "ZAR", Probability: 100, Stage: "Closed Won", CloseDate: "2025-09-10" },
])

add("Revenue", [
  { RevenueId: "R-01", Customer: "Sasol", Amount: 4100000, Currency: "ZAR", OwnerDepartmentId: "DEP-PRESALES", LeadOriginDepartmentId: "DEP-PRESALES", InfluencingDepartmentId: "DEP-SALES", DeliveringDepartmentId: "DEP-DELIVERY", RecognizedDate: "2025-09-01", Type: "Resell" },
  { RevenueId: "R-02", Customer: "Standard Bank", Amount: 6100000, Currency: "ZAR", OwnerDepartmentId: "DEP-PS", LeadOriginDepartmentId: "DEP-SALES", InfluencingDepartmentId: "DEP-PRESALES", DeliveringDepartmentId: "DEP-PS", RecognizedDate: "2025-09-20", Type: "Services" },
  { RevenueId: "R-03", Customer: "Sasol", Amount: 220000, Currency: "USD", OwnerDepartmentId: "DEP-PRESALES", LeadOriginDepartmentId: "DEP-PRESALES", InfluencingDepartmentId: "", DeliveringDepartmentId: "DEP-DELIVERY", RecognizedDate: "2025-09-01", Type: "Resell UiPath" },
  { RevenueId: "R-04", Customer: "Absa", Amount: 3200000, Currency: "ZAR", OwnerDepartmentId: "DEP-SALES", LeadOriginDepartmentId: "DEP-SALES", InfluencingDepartmentId: "", DeliveringDepartmentId: "DEP-DELIVERY", RecognizedDate: "2025-06-15", Type: "Resell" },
  { RevenueId: "R-05", Customer: "Telkom", Amount: 2750000, Currency: "ZAR", OwnerDepartmentId: "DEP-PS", LeadOriginDepartmentId: "DEP-PS", InfluencingDepartmentId: "DEP-DELIVERY", DeliveringDepartmentId: "DEP-PS", RecognizedDate: "2025-07-10", Type: "Services" },
])

add("Engagements", [
  { EngagementId: "E-01", Customer: "Sasol", Name: "Finance Automation", Type: "Resell Customer Engagement", QualificationStatus: "Qualified", ContractValue: 4100000, Currency: "ZAR", NPSStatus: "Submitted", CSATStatus: "Submitted", Date: "2025-09-05" },
  { EngagementId: "E-02", Customer: "Standard Bank", Name: "KYC Delivery", Type: "Unique Professional Services Engagement", QualificationStatus: "Qualified", ContractValue: 6100000, Currency: "ZAR", NPSStatus: "Submitted", CSATStatus: "Pending", Date: "2025-09-25" },
  { EngagementId: "E-03", Customer: "Telkom", Name: "Ops Automation", Type: "Professional Services Engagement", QualificationStatus: "Qualified", ContractValue: 2750000, Currency: "ZAR", NPSStatus: "Pending", CSATStatus: "Submitted", Date: "2025-07-15" },
  { EngagementId: "E-04", Customer: "Absa", Name: "POC", Type: "Non-Qualifying Engagement", QualificationStatus: "Not Qualified", ContractValue: 0, Currency: "ZAR", NPSStatus: "N/A", CSATStatus: "N/A", Date: "2025-06-20" },
  { EngagementId: "E-05", Customer: "Old Mutual", Name: "Policy Servicing", Type: "Professional Services Engagement", QualificationStatus: "In Progress", ContractValue: 3900000, Currency: "ZAR", NPSStatus: "Pending", CSATStatus: "Pending", Date: "2025-10-01" },
])

add("ResellRequirements", [
  { RequirementId: "RR-01", Requirement: "Annual Resell Revenue (USD)", RequiredValue: 500000, AttainedValue: 420000, Unit: "USD", Owner: "Naledi Khumalo", DueDate: "2026-03-31", Status: "Outstanding" },
  { RequirementId: "RR-02", Requirement: "Certified Sales Professionals", RequiredValue: 4, AttainedValue: 3, Unit: "people", Owner: "Naledi Khumalo", DueDate: "2026-01-31", Status: "Outstanding" },
  { RequirementId: "RR-03", Requirement: "Certified Technical Resources", RequiredValue: 6, AttainedValue: 6, Unit: "people", Owner: "Aisha Patel", DueDate: "2025-12-31", Status: "Achieved" },
  { RequirementId: "RR-04", Requirement: "Net New Customers", RequiredValue: 8, AttainedValue: 5, Unit: "customers", Owner: "Naledi Khumalo", DueDate: "2026-03-31", Status: "Outstanding" },
  { RequirementId: "RR-05", Requirement: "Customer Success Stories", RequiredValue: 3, AttainedValue: 3, Unit: "stories", Owner: "Lerato Dlamini", DueDate: "2025-11-30", Status: "Maintain" },
])

add("ServicesRequirements", [
  { RequirementId: "SR-01", Requirement: "Delivery Certifications", RequiredValue: 5, AttainedValue: 4, Unit: "people", Owner: "Johan van der Merwe", DueDate: "2026-02-28", Status: "Outstanding" },
  { RequirementId: "SR-02", Requirement: "Unique PS Engagements", RequiredValue: 6, AttainedValue: 4, Unit: "engagements", Owner: "Thabo Mokoena", DueDate: "2026-03-31", Status: "Outstanding" },
  { RequirementId: "SR-03", Requirement: "Services Revenue (USD)", RequiredValue: 300000, AttainedValue: 310000, Unit: "USD", Owner: "Johan van der Merwe", DueDate: "2026-03-31", Status: "Achieved" },
  { RequirementId: "SR-04", Requirement: "CSAT Submissions", RequiredValue: 6, AttainedValue: 3, Unit: "submissions", Owner: "Thabo Mokoena", DueDate: "2026-01-31", Status: "Outstanding" },
  { RequirementId: "SR-05", Requirement: "Advanced Developer Certs", RequiredValue: 3, AttainedValue: 3, Unit: "people", Owner: "Johan van der Merwe", DueDate: "2025-12-31", Status: "Maintain" },
])

add("Overrides", [
  { OverrideId: "OV-01", EntityType: "Certification", EntityId: "C-05", Field: "status", Value: "Active", Reason: "Grace period granted by UiPath partner manager" },
])

add("ReportingPeriods", [
  { PeriodId: "FY26-Q1", Name: "FY2026 Q1", StartDate: "2025-04-01", EndDate: "2025-06-30", Active: "FALSE" },
  { PeriodId: "FY26-Q2", Name: "FY2026 Q2", StartDate: "2025-07-01", EndDate: "2025-09-30", Active: "TRUE" },
  { PeriodId: "FY26-Q3", Name: "FY2026 Q3", StartDate: "2025-10-01", EndDate: "2025-12-31", Active: "FALSE" },
  { PeriodId: "FY26-Q4", Name: "FY2026 Q4", StartDate: "2026-01-01", EndDate: "2026-03-31", Active: "FALSE" },
])

mkdirSync("public", { recursive: true })
const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
writeFileSync("public/sample-workbook.xlsx", out)
console.log("Wrote public/sample-workbook.xlsx")
