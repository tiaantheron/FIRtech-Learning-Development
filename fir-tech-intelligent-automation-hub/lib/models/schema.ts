// Schema definitions drive both parsing and structural validation.
// Each worksheet lists the columns the application expects and their type.

export type ColumnType = "string" | "number" | "percent" | "boolean" | "date" | "list"

export interface ColumnDef {
  key: string // property name on the parsed object
  header: string // exact column header expected in the worksheet
  type: ColumnType
  required?: boolean
  unique?: boolean
  optional?: boolean
}

export interface SheetDef {
  name: string // worksheet name / model key
  sheet: string // worksheet tab name in the workbook
  columns: ColumnDef[]
}

export const SHEET_DEFS: Record<string, SheetDef> = {
  overview: {
    name: "overview",
    sheet: "Overview",
    columns: [
      { key: "key", header: "Key", type: "string", required: true, unique: true },
      { key: "value", header: "Value", type: "string", required: true },
    ],
  },
  departments: {
    name: "departments",
    sheet: "Departments",
    columns: [
      { key: "departmentId", header: "DepartmentId", type: "string", required: true, unique: true },
      { key: "status", header: "Status", type: "string", optional: true },
      { key: "name", header: "Name", type: "string", required: true },
      { key: "head", header: "Head", type: "string" },
      { key: "revenueAllocationPct", header: "RevenueAllocationPct", type: "percent" },
      { key: "revenueTargetZAR", header: "RevenueTargetZAR", type: "number" },
      { key: "leadTarget", header: "LeadTarget", type: "number" },
      { key: "opportunityTarget", header: "OpportunityTarget", type: "number" },
    ],
  },
  people: {
    name: "people",
    sheet: "People",
    columns: [
      { key: "personId", header: "PersonId", type: "string", required: true, unique: true },
      { key: "fullName", header: "FullName", type: "string", required: true },
      { key: "jobTitle", header: "JobTitle", type: "string" },
      { key: "primaryDepartmentId", header: "PrimaryDepartmentId", type: "string" },
      { key: "secondaryDepartmentIds", header: "SecondaryDepartmentIds", type: "list" },
      { key: "managerId", header: "ManagerId", type: "string" },
      { key: "employmentStatus", header: "EmploymentStatus", type: "string" },
      { key: "uiPathId", header: "UiPathId", type: "string" },
    ],
  },
  departmentMemberships: {
    name: "departmentMemberships",
    sheet: "DepartmentMemberships",
    columns: [
      { key: "membershipId", header: "MembershipId", type: "string", required: true, unique: true },
      { key: "personId", header: "PersonId", type: "string", required: true },
      { key: "departmentId", header: "DepartmentId", type: "string", required: true },
      { key: "role", header: "Role", type: "string" },
      { key: "isPrimary", header: "IsPrimary", type: "boolean" },
    ],
  },
  trainingAssignments: {
    name: "trainingAssignments",
    sheet: "TrainingAssignments",
    columns: [
      { key: "assignmentId", header: "AssignmentId", type: "string", required: true, unique: true },
      { key: "personId", header: "PersonId", type: "string", required: true },
      { key: "courseName", header: "CourseName", type: "string", required: true },
      { key: "status", header: "Status", type: "string", required: true },
      { key: "assignedDate", header: "AssignedDate", type: "date" },
      { key: "dueDate", header: "DueDate", type: "date" },
      { key: "completedDate", header: "CompletedDate", type: "date" },
    ],
  },
  certifications: {
    name: "certifications",
    sheet: "Certifications",
    columns: [
      { key: "certificationId", header: "CertificationId", type: "string", required: true, unique: true },
      { key: "personId", header: "PersonId", type: "string", required: true },
      { key: "certName", header: "CertName", type: "string", required: true },
      { key: "status", header: "Status", type: "string", required: true },
      { key: "issueDate", header: "IssueDate", type: "date" },
      { key: "expiryDate", header: "ExpiryDate", type: "date" },
      { key: "uiPathCertCode", header: "UiPathCertCode", type: "string" },
      { key: "dueDate", header: "DueDate", type: "date", optional: true },
    ],
  },
  leads: {
    name: "leads",
    sheet: "Leads",
    columns: [
      { key: "leadId", header: "LeadId", type: "string", required: true, unique: true },
      { key: "customer", header: "Customer", type: "string", required: true },
      { key: "owner", header: "Owner", type: "string" },
      { key: "departmentId", header: "DepartmentId", type: "string" },
      { key: "estimatedValue", header: "EstimatedValue", type: "number" },
      { key: "currency", header: "Currency", type: "string" },
      { key: "source", header: "Source", type: "string" },
      { key: "status", header: "Status", type: "string" },
      { key: "createdDate", header: "CreatedDate", type: "date" },
    ],
  },
  opportunities: {
    name: "opportunities",
    sheet: "Opportunities",
    columns: [
      { key: "opportunityId", header: "OpportunityId", type: "string", required: true, unique: true },
      { key: "customer", header: "Customer", type: "string", required: true },
      { key: "name", header: "Name", type: "string", required: true },
      { key: "owner", header: "Owner", type: "string" },
      { key: "departmentId", header: "DepartmentId", type: "string" },
      { key: "estimatedValue", header: "EstimatedValue", type: "number" },
      { key: "currency", header: "Currency", type: "string" },
      { key: "probability", header: "Probability", type: "percent" },
      { key: "stage", header: "Stage", type: "string", required: true },
      { key: "closeDate", header: "CloseDate", type: "date" },
    ],
  },
  revenue: {
    name: "revenue",
    sheet: "Revenue",
    columns: [
      { key: "revenueId", header: "RevenueId", type: "string", required: true, unique: true },
      { key: "customer", header: "Customer", type: "string", required: true },
      { key: "amount", header: "Amount", type: "number", required: true },
      { key: "currency", header: "Currency", type: "string", required: true },
      { key: "ownerDepartmentId", header: "OwnerDepartmentId", type: "string" },
      { key: "leadOriginDepartmentId", header: "LeadOriginDepartmentId", type: "string" },
      { key: "influencingDepartmentId", header: "InfluencingDepartmentId", type: "string" },
      { key: "deliveringDepartmentId", header: "DeliveringDepartmentId", type: "string" },
      { key: "recognizedDate", header: "RecognizedDate", type: "date" },
      { key: "type", header: "Type", type: "string" },
    ],
  },
  engagements: {
    name: "engagements",
    sheet: "Engagements",
    columns: [
      { key: "engagementId", header: "EngagementId", type: "string", required: true, unique: true },
      { key: "uniqueCustomer", header: "UniqueCustomer", type: "boolean", optional: true },
      { key: "departmentId", header: "DepartmentId", type: "string", optional: true },
      { key: "owner", header: "Owner", type: "string", optional: true },
      { key: "customer", header: "Customer", type: "string", required: true },
      { key: "name", header: "Name", type: "string", required: true },
      { key: "type", header: "Type", type: "string", required: true },
      { key: "qualificationStatus", header: "QualificationStatus", type: "string" },
      { key: "contractValue", header: "ContractValue", type: "number" },
      { key: "currency", header: "Currency", type: "string" },
      { key: "npsStatus", header: "NPSStatus", type: "string" },
      { key: "csatStatus", header: "CSATStatus", type: "string" },
      { key: "date", header: "Date", type: "date" },
    ],
  },
  resellRequirements: {
    name: "resellRequirements",
    sheet: "ResellRequirements",
    columns: requirementColumns(),
  },
  servicesRequirements: {
    name: "servicesRequirements",
    sheet: "ServicesRequirements",
    columns: requirementColumns(),
  },
  overrides: {
    name: "overrides",
    sheet: "Overrides",
    columns: [
      { key: "overrideId", header: "OverrideId", type: "string", required: true, unique: true },
      { key: "entityType", header: "EntityType", type: "string", required: true },
      { key: "entityId", header: "EntityId", type: "string", required: true },
      { key: "field", header: "Field", type: "string", required: true },
      { key: "value", header: "Value", type: "string" },
      { key: "reason", header: "Reason", type: "string" },
    ],
  },
  reportingPeriods: {
    name: "reportingPeriods",
    sheet: "ReportingPeriods",
    columns: [
      { key: "periodId", header: "PeriodId", type: "string", required: true, unique: true },
      { key: "name", header: "Name", type: "string", required: true },
      { key: "startDate", header: "StartDate", type: "date" },
      { key: "endDate", header: "EndDate", type: "date" },
      { key: "active", header: "Active", type: "boolean" },
    ],
  },
}

function requirementColumns(): ColumnDef[] {
  return [
    { key: "departmentId", header: "DepartmentId", type: "string", optional: true },
    { key: "requirementId", header: "RequirementId", type: "string", required: true, unique: true },
    { key: "requirement", header: "Requirement", type: "string", required: true },
    { key: "requiredValue", header: "RequiredValue", type: "number" },
    { key: "attainedValue", header: "AttainedValue", type: "number" },
    { key: "unit", header: "Unit", type: "string" },
    { key: "owner", header: "Owner", type: "string" },
    { key: "dueDate", header: "DueDate", type: "date" },
    { key: "status", header: "Status", type: "string" },
  ]
}

export const REQUIRED_SHEETS = Object.values(SHEET_DEFS).map((d) => d.sheet)

export const FX_COLUMNS: ColumnDef[] = [
  { key: "reportingCurrency", header: "ReportingCurrency", type: "string", optional: true },
  { key: "convertedAmount", header: "ConvertedAmount", type: "number", optional: true },
  { key: "exchangeRate", header: "ExchangeRate", type: "number", optional: true },
  { key: "exchangeRateDate", header: "ExchangeRateDate", type: "date", optional: true },
  { key: "exchangeRateSource", header: "ExchangeRateSource", type: "string", optional: true },
]
for (const key of ["leads", "opportunities", "revenue", "engagements"]) SHEET_DEFS[key].columns.push(...FX_COLUMNS)
