# FIRtech Intelligent Automation Hub

A React + TypeScript application. Excel is the authoritative business record. In a configured Vercel deployment, the shared workbook is stored in SharePoint and transported through Microsoft Graph by the server-side `/api/workbook` route. Local development can still use a browser-selected workbook. Optional workbook-based sign-in governs application actions; this is not a server-enforced security boundary. See [MICROSOFT_GRAPH_SETUP.md](MICROSOFT_GRAPH_SETUP.md) before deploying.

## Run locally

Requires Node.js 22.12+ and pnpm.

```sh
pnpm install
pnpm dev
```

Open the local address printed by Vite. `pnpm build` type-checks and builds the static application into `dist/`; `pnpm start` previews that build. `pnpm test` runs the calculation/import regression suite.

## Workbook workflow

The dashboard loads the SharePoint workbook from `/api/workbook` when the Vercel environment is configured. The workbook must already exist in SharePoint and contain the configured Excel Table. Edits save to that same workbook through Microsoft Graph; a 30-second configurable poll and manual Refresh surface direct Excel changes. An ETag prevents an app save based on an older workbook revision from silently replacing newer work. A workbook larger than 4.5 MB needs a different upload route.

For Microsoft Entra registration, SharePoint workbook preparation, Vercel variables, and verification, follow [MICROSOFT_GRAPH_SETUP.md](MICROSOFT_GRAPH_SETUP.md). Graph credentials remain on the Vercel server. SharePoint reads and writes are disabled until their server-only enable flags are set. The endpoint is not protected by server-enforced user authorization; restrict deployment access before enabling it or using confidential multi-user data.

The browser remembers the file handle in IndexedDB, without storing workbook contents or a raw path. On the next visit, **Reconnect workbook** requests access and reads the current source. Access is specific to this browser profile and application origin; moving the file, clearing browser data or changing the local server address can require selection again. **Forget file** removes the remembered connection and switches the current workbook to download mode. Business data stays in memory until written to Excel.

Where direct access is unavailable, the ordinary file picker reads the workbook and **Download Excel** exports an updated copy. This mode cannot update the original file automatically. **Refresh** rereads a connected source (asking before discarding pending changes), or revalidates the in-memory workbook in download mode. To preserve pending edits during an external conflict, forget the connection and download a separate copy before reopening the external version.

ExcelJS retains the reference sheet layout and cell styles. The full workbook, including appended audit entries, is saved independently of dashboard filters. Reports exports filtered CSV/Excel tables separately. The **Download reference workbook** link provides the supplied nine-sheet `public/firtech_dashboard.xlsx`; it is only modified if explicitly chosen as the connected source.

The reference-format importer supports Settings, Departments, People, Memberships, Requirements, Training, Opportunities, Engagements and Audit. It resolves name-based memberships and splits the combined Requirements sheet into dashboard pathways without changing supplied attained totals. At risk maps to outstanding readiness; the original label remains intact in the exported workbook. Reference Overdue assignments map to In Progress; overdue calculations use their due dates. Notes marked Maintain preserve that requirement status.

The dashboard displays original workbook currencies by default. Its currency control switches monetary views to Rand (ZAR) using documented conversions; values without a valid ZAR rate are marked unavailable and excluded from Rand totals. This is a display choice, not a change to the source amounts. Missing original currency defaults to ZAR; explicit currencies are retained. Missing detailed Revenue, Leads and Certifications sheets can be created using Add entry within the relevant section. The Overview now shows outstanding training, while the Courses page groups employee assignments into done, doing, planned and attention states. Engagement records remain in the workbook and reports, but have no separate navigation page.

Invalid workbooks pause dashboards and reports. Open **Validation Console** for every detected issue, with worksheet, physical Excel row and column. Correct Excel and replace the workbook. Reports export the selected rows to CSV or Excel; reports are not replacements for the source workbook.

## Workbook contract

For the alternative detailed format, all 14 sheets are required: Overview, Departments, People, DepartmentMemberships, TrainingAssignments, Certifications, Leads, Opportunities, Revenue, Engagements, ResellRequirements, ServicesRequirements, Overrides, ReportingPeriods. The nine-sheet reference format is detected separately and does not require these additional sheets. `lib/models/schema.ts` is the detailed column specification; `lib/models/types.ts` defines the internal worksheet models. Empty sheets must retain their headers.

- IDs must be unique in each worksheet. Foreign keys refer to worksheet IDs, including `Owner` on sales records, which is a `PersonId`.
- Dates are Excel date cells or strict `YYYY-MM-DD` strings. Missing optional dates remain visible under period selection so undated work cannot disappear; correct missing dates for precise period reporting.
- Numbers must be numeric cells or numeric strings, without currency symbols. Percentages accept fractions (0.25), whole percentages (25), or strings (`25%`). Numeric 1 means 100%; use `1%` or 0.01 for one percent.
- Currency is the original three-letter transaction currency. Optional conversion columns are ReportingCurrency (default ZAR), ConvertedAmount, ExchangeRate, ExchangeRateDate and ExchangeRateSource. Rate means reporting-currency units per original unit. A conversion requires a positive rate, a valid date and a source; ConvertedAmount is calculated as original amount × rate rounded to cents. Rates are entered from your approved source, never fetched or invented automatically. Original-currency panels keep currencies separate; Rand panels include documented ZAR conversions once.
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

**Apply to workbook** validates the complete candidate workbook before replacing the in-memory version. Invalid changes show worksheet/row/field errors and do not change the source. Removing people/departments archives them instead of clearing their rows; Restore is available in the editor. Archived people cannot receive new assignments, and archived departments must be restored before assigning new targets. Reference-format person and department name edits update their name-based references automatically. Department allocation totals can temporarily differ from 100% while redistributing allocations, with a warning. Save Excel refuses to write until active allocations total 100%. Undo retains up to 20 business-data snapshots. It restores the previous data while preserving the latest Audit sheet and appending an Undo entry; connected sources save that undo automatically. Unsaved edits are indicated and closing/replacing the workbook prompts before discarding them.

Applied changes automatically save when a source is connected; otherwise download the updated file. Pending changes remain in browser memory until a save succeeds. An Audit sheet is created when missing and records edits as Dashboard user. Audit History is read-only in the application and can be exported. This does not provide authenticated, tamper-resistant auditing. Workbook-based roles are described below; no database or server authentication service was introduced.


## Original specification review

See SPEC-REVIEW.md for the requirement-by-requirement assessment, quick fixes implemented, and production-scope decisions that remain. Reports and audit history support printing; data tables paginate and expand matching rows for printing. Native Excel saving checks the destination bytes against the loaded/last-saved copy and stops on conflicts; this is not an atomic multi-user lock.


## Personalization

The bottom-left **Personalize** control offers FIRtech Blue, Indigo Slate and Forest Teal. Restrained gradients style the sidebar, background and cards. The preference is kept locally; it does not change the workbook. The supplied FIRtech logo appears in the sidebar.

## Verification scope

The regression suite covers workbook parsing, calculations, record lifecycle, styles, exports/report selection and source-write success/conflicts/permission and disk failures. Browser file-picker permissions and remembered-handle recovery still need a manual check in the target browser. No backend or multi-user locking was added. Audit entries identify the signed-in workbook account, which is not a verified server identity.

Missing numeric cells default to 0; descriptive text remains blank. Required worksheet headers and unique record identifiers are still validated, as are supplied dates, relationships and conversion metadata. Blank rows do not create entries. ZAR remains the currency default.


## Roles and optional sign-in

Every new visit starts as Viewer. Sign in from the lower-left sidebar. The built-in account is `admin` / `admin`; its salted PBKDF2 password hash and Administrator role are stored in the source workbook's separate Users worksheet. It is not added to People, ownership selectors or business reports and is excluded from the user-management list. Its edits are audited as System administrator. The built-in account cannot be modified through the app.

Administrators manage users, departments, people, pathways, requirements, targets, allocations, overrides, periods, settings, imports, full-workbook exports, archives/restores and complete audit history. In Users & permissions, add accounts or change their roles, permitted department IDs, active status, report-export permission, and explicit pathway/user-management grants. Disable an account to remove access; password resets take effect immediately in the current session. Account passwords and evidence payloads are redacted from audit snapshots. Source replacements and reconnections end the current sign-in; sign in against the newly loaded Users sheet.

Contributors can add/update training, certification, lead, opportunity, revenue and engagement records in their permitted departments, plus notes and supporting evidence. They cannot remove/archive records or edit configuration, calculations or user permissions. ManagePathways and ManageUsers are explicit optional grants. Department checks apply to both the original and new record to prevent moving records into or out of an unauthorised department. Use comma-separated department IDs; `*` means all departments and a blank list means none. Dashboard data and reports are scoped before applying interactive filters.

Viewers can view, filter, search and open evidence. Signed-in Viewer accounts may export reports if ExportReports is enabled; anonymous Viewer has report exports disabled. Native browser printing/copying cannot be prevented. Full-workbook download remains Administrator-only.

Supporting evidence accepts PDF, PNG, JPEG and plain text up to 1 MB each. Files are split across Excel-safe cell lengths in an Evidence worksheet, alongside department, related record ID and notes, and persist with the workbook. Administrators can remove evidence. Contributors can upload it; all roles can open evidence within their department scope.

These are local application permissions. Anyone who can access the source Excel file or modify browser code can bypass them; the bundled file is a public static asset. Secure multi-user authorization, credential protection and authoritative audit require a server that checks every request and keeps the workbook and credentials private. No production security claim is made by this implementation.

## Final delivery QA — 11 September 2026

See QA-CHECKLIST.md for the current acceptance status and evidence; it supersedes older test checklists for this delivery. The default source now includes empty Leads, Revenue and Certifications worksheets with their actual schema headers. No demonstration transactions were added to those sheets. The sample-workbook generator also labels its dataset Mock/draft. Report and audit exports carry Source status metadata.

Existing record IDs/keys are immutable through the mutation service and editor; new ID-bearing forms offer a generated UUID. Legacy reference relationships still use names and are translated to IDs at import. Renaming a person/department follows the legacy references. Archive/remove uses an inline confirmation; Restore is direct and audited. People and departments support archive/restore. Other records support removal and same-session undo, not a uniform archive lifecycle.

Download mode keeps unsaved changes pending after requesting a download. Confirm **I saved the downloaded file** only after verifying the file exists. A further edit invalidates acknowledgement of an earlier download. This confirmation records your acknowledgement, not an operating-system guarantee. If downloads are blocked, keep the tab open and use a supported desktop browser. In local mode, **Import a copy** opens a file without changing another source. In SharePoint mode, an administrator's replacement import saves to the configured SharePoint workbook after validation. Connect/reconnect/replace operations reset the local profile to Viewer; sign in again against that workbook.

The delivery smoke test exercised the real UI but could not complete native download/file-chooser round-tripping in the available in-app browser. Serialization, disk read-back, calculated values and retained audit entries pass automated tests. A full desktop-browser save/reload acceptance test remains required. No cloud deployment or production identity/persistence infrastructure was added.
