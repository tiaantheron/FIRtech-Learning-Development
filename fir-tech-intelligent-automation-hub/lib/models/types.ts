// Strongly typed models for each worksheet in the FIRtech workbook.
// Excel is the authoritative source of truth; these types mirror the sheet columns.

export type PartnerLevel = "None" | "Registered" | "Silver" | "Gold" | "Platinum" | "Diamond"

export const TRAINING_STATUSES = [
  "Not Allocated",
  "Allocated",
  "Not Started",
  "In Progress",
  "Exam Scheduled",
  "Awaiting Result",
  "Passed",
  "Failed",
  "Completed",
  "Expired",
  "Waived",
  "Not Applicable",
] as const
export type TrainingStatus = (typeof TRAINING_STATUSES)[number]

export const CERT_STATUSES = [
  ...TRAINING_STATUSES,
  "Not Started",
  "In Progress",
  "Scheduled",
  "Passed",
  "Failed",
  "Active",
  "Expired",
  "Waived",
] as const
export type CertStatus = (typeof CERT_STATUSES)[number]

export const REQUIREMENT_STATUSES = ["Achieved", "Outstanding", "Maintain"] as const
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number]

export const ENGAGEMENT_CATEGORIES = [
  "Resell Customer Engagement",
  "Professional Services Engagement",
  "Unique Professional Services Engagement",
  "Non-Qualifying Engagement",
] as const
export type EngagementCategory = (typeof ENGAGEMENT_CATEGORIES)[number]

export type Currency = string

export interface CurrencyConversion {
  reportingCurrency?: string
  convertedAmount?: number
  exchangeRate?: number
  exchangeRateDate?: string | null
  exchangeRateSource?: string
}

export interface OverviewSetting {
  key: string
  value: string
}

export interface Department {
  status?: string
  departmentId: string
  name: string
  head: string
  revenueAllocationPct: number
  revenueTargetZAR: number
  leadTarget: number
  opportunityTarget: number
}

export interface Person {
  personId: string
  fullName: string
  jobTitle: string
  primaryDepartmentId: string
  secondaryDepartmentIds: string[]
  managerId: string
  employmentStatus: string
  uiPathId: string
}

export interface DepartmentMembership {
  membershipId: string
  personId: string
  departmentId: string
  role: string
  isPrimary: boolean
}

export interface TrainingAssignment {
  assignmentId: string
  personId: string
  courseName: string
  status: TrainingStatus
  assignedDate: string | null
  dueDate: string | null
  completedDate: string | null
}

export interface Certification {
  dueDate?: string | null
  certificationId: string
  personId: string
  certName: string
  status: CertStatus
  issueDate: string | null
  expiryDate: string | null
  uiPathCertCode: string
}

export interface Lead extends CurrencyConversion {
  leadId: string
  customer: string
  owner: string
  departmentId: string
  estimatedValue: number
  currency: Currency
  source: string
  status: string
  createdDate: string | null
}

export interface Opportunity extends CurrencyConversion {
  opportunityId: string
  customer: string
  name: string
  owner: string
  departmentId: string
  estimatedValue: number
  currency: Currency
  probability: number
  stage: string
  closeDate: string | null
}

export interface RevenueRecord extends CurrencyConversion {
  revenueId: string
  customer: string
  amount: number
  currency: Currency
  ownerDepartmentId: string
  leadOriginDepartmentId: string
  influencingDepartmentId: string
  deliveringDepartmentId: string
  recognizedDate: string | null
  type: string
}

export interface Engagement extends CurrencyConversion {
  uniqueCustomer?: boolean
  departmentId?: string
  owner?: string
  engagementId: string
  customer: string
  name: string
  type: EngagementCategory
  qualificationStatus: string
  contractValue: number
  currency: Currency
  npsStatus: string
  csatStatus: string
  date: string | null
}

export interface Requirement {
  departmentId?: string
  requirementId: string
  requirement: string
  requiredValue: number
  attainedValue: number
  unit: string
  owner: string
  dueDate: string | null
  status: RequirementStatus
}

export interface Override {
  overrideId: string
  entityType: string
  entityId: string
  field: string
  value: string
  reason: string
}

export interface ReportingPeriod {
  periodId: string
  name: string
  startDate: string | null
  endDate: string | null
  active: boolean
}

export interface WorkbookData {
  overview: OverviewSetting[]
  departments: Department[]
  people: Person[]
  departmentMemberships: DepartmentMembership[]
  trainingAssignments: TrainingAssignment[]
  certifications: Certification[]
  leads: Lead[]
  opportunities: Opportunity[]
  revenue: RevenueRecord[]
  engagements: Engagement[]
  resellRequirements: Requirement[]
  servicesRequirements: Requirement[]
  overrides: Override[]
  reportingPeriods: ReportingPeriod[]
}

export type ValidationSeverity = "error" | "warning"

export interface ValidationIssue {
  severity: ValidationSeverity
  worksheet: string
  row: number | null
  field: string | null
  message: string
}

export interface ParseResult {
  data: WorkbookData | null
  issues: ValidationIssue[]
  loadedAt: string
  fileName: string
}
