# FIRtech Intelligent Automation Hub

A Phase 1, browser-only React + TypeScript application. Excel is the authoritative business record. No database, backend, authentication, browser business-data persistence, or cloud service is used.

## Run locally

Requires Node.js 22.12+ and pnpm.

```sh
pnpm install
pnpm dev
```

Open the local address printed by Vite. `pnpm build` type-checks and builds the static application into `dist/`; `pnpm start` previews that build. `pnpm test` runs the calculation/import regression suite.

## Workbook workflow

The application starts with an **Open your Excel workbook** prompt. Click **Choose Excel file** to browse any folder or accessible drive. No workbook is loaded automatically. The **Download reference workbook** link provides `public/firtech_dashboard.xlsx`, the supplied nine-sheet layout. Its Settings sheet identifies its data as mock/draft.

Use **Replace workbook** to select another `.xlsx` file. All parsing happens in your browser. **Refresh** revalidates the currently edited workbook; to pick up edits saved externally, select the updated workbook again. Reloading the browser returns to the file-selection prompt. Use **Save Excel** to choose a destination and write the revised workbook. In browsers without the file-save API, this downloads an updated Excel file instead.

**Save Excel** writes the current workbook, including edits, additions, removals and appended audit entries. ExcelJS retains the reference workbook sheet layout and cell styles. This export is unfiltered; Reports provides separate filtered CSV/Excel tables. Save to the original path to replace it, or choose a new filename. The next save reuses that selected destination. Cancelling the picker keeps edits unsaved.

The reference-format importer supports Settings, Departments, People, Memberships, Requirements, Training, Opportunities, Engagements and Audit. It resolves name-based memberships and splits the combined Requirements sheet into dashboard pathways without changing supplied attained totals. At risk maps to outstanding readiness; the original label remains intact in the exported workbook. Reference Overdue assignments map to In Progress; overdue calculations use their due dates. Notes marked Maintain preserve that requirement status.

Reporting defaults to South African rand (ZAR), with no currency-selection prompt. Missing original currency defaults to ZAR; explicit currencies are retained. Foreign amounts without documented conversion data stay in their original currency and are excluded from ZAR totals with a validation warning. Missing detailed Revenue, Leads and Certifications sheets can be created using Add entry within the relevant section.

Invalid workbooks pause dashboards and reports. Open **Validation Console** for every detected issue, with worksheet, physical Excel row and column. Correct Excel and replace the workbook. Reports export the selected rows to CSV or Excel; reports are not replacements for the source workbook.

## Workbook contract

For the alternative detailed format, all 14 sheets are required: Overview, Departments, People, DepartmentMemberships, TrainingAssignments, Certifications, Leads, Opportunities, Revenue, Engagements, ResellRequirements, ServicesRequirements, Overrides, ReportingPeriods. The nine-sheet reference format is detected separately and does not require these additional sheets. `lib/models/schema.ts` is the detailed column specification; `lib/models/types.ts` defines the internal worksheet models. Empty sheets must retain their headers.

- IDs must be unique in each worksheet. Foreign keys refer to worksheet IDs, including `Owner` on sales records, which is a `PersonId`.
- Dates are Excel date cells or strict `YYYY-MM-DD` strings. Missing optional dates remain visible under period selection so undated work cannot disappear; correct missing dates for precise period reporting.
- Numbers must be numeric cells or numeric strings, without currency symbols. Percentages accept fractions (0.25), whole percentages (25), or strings (`25%`). Numeric 1 means 100%; use `1%` or 0.01 for one percent.
- Currency is the original three-letter transaction currency. Optional conversion columns are ReportingCurrency (default ZAR), ConvertedAmount, ExchangeRate, ExchangeRateDate and ExchangeRateSource. Rate means reporting-currency units per original unit. A conversion requires a positive rate, a valid date and a source; ConvertedAmount is calculated as original amount × rate rounded to cents. Rates are entered from your approved source, never fetched or invented automatically. ZAR dashboards include documented ZAR conversions once, while USD panels retain original USD amounts and must not be added to ZAR panels.
- `Engagements.DepartmentId` and `Owner` are optional extension columns for attribution. Legacy engagements lacking department attribution appear in company totals only, never credited to every department. `Certifications.DueDate` is an optional deadline for outstanding certification work.
- DepartmentMemberships adds secondary memberships without duplicating employees. People retains its primary department and full training/certification history.
- Training accepts all statuses in the brief. Certifications additionally accepts `Active` and `Scheduled` for compatibility with the supplied starter workbook.

## Calculation and reporting semantics

Requirements, current/target levels, required values, attained values and statuses come from Excel. Supplied totals are never replaced by inferred operational totals. Remaining = max(required − attained, 0). Readiness is the share of supplied requirements marked Achieved or Maintain; it is not an official partner-status determination.

Period filters use recognition dates for revenue, close dates for opportunities, creation dates for leads, engagement dates, requirement due dates, and training due dates (assignment date fallback). Certification inventory includes records issued by period end; validity and expiry risk are evaluated as of today. Requirement owners can be department IDs/names or employee IDs/names. Employee filters are available on training, certification and pipeline reports, which have employee ownership. Revenue and engagement reports use department/period attribution.

Revenue is counted once against its owning department. Lead-origin, influencing and delivering departments are descriptive attribution. Duplicate revenue IDs and suspicious repeated customer/amount/currency/date records block import pending reconciliation. Different valid same-value transactions must have distinguishable source records; do not silently delete them.

Only open opportunities contribute to pipeline. Closed Won forces weighted probability to 100%; Closed Lost forces 0%. Conversion is won opportunities / all closed opportunities. Revenue recognition and won opportunity value are separate measures and are not added together.

Workbook targets are not prorated when selecting a shorter reporting period. Historical actuals remain available in the revenue trend and all-period views. To change historical target assumptions, retain the appropriate authoritative workbook version; this application does not fabricate historical target snapshots absent from the workbook.

Engagement qualification uses the supplied qualification status. NPS and CSAT are shown separately and are not used to invent eligibility rules. Unique professional services counts distinct qualified customers. Duplicate qualification records are rejected for reconciliation.

## Explicit overrides

Overrides require a unique OverrideId, an existing entity, a supported field and a nonempty Reason. Multiple overrides for the same entity/field are rejected. The register is visible on Partner Pathways.

| EntityType | EntityId | Supported Field | Value |
| --- | --- | --- | --- |
| Certification | CertificationId | status | Valid certification status; Active or Passed explicitly counts an expired certificate |
| ResellRequirement | RequirementId | attainedValue, requiredValue, status | Nonnegative numeric value, or Achieved / Outstanding / Maintain |
| ServicesRequirement | RequirementId | attainedValue, requiredValue, status | Same as ResellRequirement |

Overrides are applied in memory without modifying raw workbook values. No implicit waiver is inferred from the existence of an override row.

## Code layout

`app/` contains the ten page modules; `components/` contains reusable controls/charts; `lib/models/` defines data; `lib/services/` parses and exports; `lib/validation/` validates; `lib/calculations/` owns business calculations and shared filters; `lib/reports/` defines nine reports; `lib/workbook-context.tsx` provides React Context and hooks. React Router is configured in `main.tsx`.

No public hosting was configured. For any future static hosting, route unknown paths to `index.html` for React Router.

## Editing from the dashboard

Each section includes **Edit / add / remove**. Choose the source sheet, search for a record, and use Edit or Remove; use Add entry for a new record. The editor shows all source records independently of dashboard filters. Calculated KPI cards update from their underlying records. ConvertedAmount, Remaining and WeightedValue are recalculated; arbitrary Excel formula cells are protected from direct editing and Excel recalculates formulas when opening the exported file.

**Apply to workbook** validates the complete candidate workbook before replacing the in-memory version. Invalid changes show worksheet/row/field errors and do not change the source. Deleting linked people/departments is rejected. Reference-format person and department name edits update their name-based references automatically. Department allocation totals can temporarily differ from 100% while redistributing allocations, with a warning. Undo restores the previous complete workbook snapshot, including its audit state. Unsaved edits are indicated and closing/replacing the workbook prompts before discarding them.

Changes are in browser memory until **Save Excel** succeeds. The reference file in public is never modified automatically; choose it as the destination if you want to replace it. The Audit sheet, when present, records additions, updates and deletions as Dashboard user. No authentication or database was introduced.
