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

Click **Choose Excel file** to browse any folder or accessible drive. Where the browser exposes the File System Access API, allow read/write access: each applied edit, addition, removal or undo automatically saves to that same source file. Intermediate form typing is not saved. Invalid changes are rejected; allocation changes remain pending until active allocations total 100%. The app serializes writes and indicates pending changes or save failures. File locks, revoked access and changed source bytes stop saving without intentionally overwriting the newer file. Close Excel if it holds a lock, then use **Save Excel** to retry. This byte comparison is not an atomic multi-user lock.

The browser remembers the file handle in IndexedDB, without storing workbook contents or a raw path. On the next visit, **Reconnect workbook** requests access and reads the current source. Access is specific to this browser profile and application origin; moving the file, clearing browser data or changing the local server address can require selection again. **Forget file** removes the remembered connection and switches the current workbook to download mode. Business data stays in memory until written to Excel.

Where direct access is unavailable, the ordinary file picker reads the workbook and **Download Excel** exports an updated copy. This mode cannot update the original file automatically. **Refresh** rereads a connected source (asking before discarding pending changes), or revalidates the in-memory workbook in download mode. To preserve pending edits during an external conflict, forget the connection and download a separate copy before reopening the external version.

ExcelJS retains the reference sheet layout and cell styles. The full workbook, including appended audit entries, is saved independently of dashboard filters. Reports exports filtered CSV/Excel tables separately. The **Download reference workbook** link provides the supplied nine-sheet `public/firtech_dashboard.xlsx`; it is only modified if explicitly chosen as the connected source.

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

`app/` contains lazily loaded page modules; `components/` contains reusable controls/charts; `lib/models/` defines data; `lib/services/` parses and exports; `lib/validation/` validates; `lib/calculations/` owns business calculations and shared filters; `lib/reports/` defines the report catalogue; `lib/workbook-context.tsx` provides React Context and hooks. React Router is configured in `main.tsx`.

No public hosting was configured. For any future static hosting, route unknown paths to `index.html` for React Router.

## Editing from the dashboard

Each section includes **Edit / add / remove**. Choose the source sheet, search for a record, and use Edit or Remove; use Add entry for a new record. The editor shows all source records independently of dashboard filters. Calculated KPI cards update from their underlying records. ConvertedAmount, Remaining and WeightedValue are recalculated; arbitrary Excel formula cells are protected from direct editing and Excel recalculates formulas when opening the exported file.

**Apply to workbook** validates the complete candidate workbook before replacing the in-memory version. Invalid changes show worksheet/row/field errors and do not change the source. Removing people/departments archives them instead of clearing their rows; Restore is available in the editor. Archived people cannot receive new assignments, and archived departments must be restored before assigning new targets. Reference-format person and department name edits update their name-based references automatically. Department allocation totals can temporarily differ from 100% while redistributing allocations, with a warning. Save Excel refuses to write until active allocations total 100%. Undo retains up to 20 complete workbook snapshots and restores the previous snapshot, including its audit state; connected sources save that undo automatically. Unsaved edits are indicated and closing/replacing the workbook prompts before discarding them.

Applied changes automatically save when a source is connected; otherwise download the updated file. Pending changes remain in browser memory until a save succeeds. An Audit sheet is created when missing and records edits as Dashboard user. Audit History is read-only in the application and can be exported. This does not provide authenticated, tamper-resistant auditing. No authentication or database was introduced.


## Original specification review

See SPEC-REVIEW.md for the requirement-by-requirement assessment, quick fixes implemented, and production-scope decisions that remain. Reports and audit history support printing; data tables paginate and expand matching rows for printing. Native Excel saving checks the destination bytes against the loaded/last-saved copy and stops on conflicts; this is not an atomic multi-user lock.


## Personalization

The bottom-left **Personalize** control offers FIRtech Blue, Indigo Slate and Forest Teal. Restrained gradients style the sidebar, background and cards. The preference is kept locally; it does not change the workbook. The supplied FIRtech logo appears in the sidebar.

## Verification scope

The regression suite covers workbook parsing, calculations, record lifecycle, styles, exports/report selection and source-write success/conflicts/permission and disk failures. Browser file-picker permissions and remembered-handle recovery still need a manual check in the target browser. No backend, multi-user locking or authenticated audit was added.
