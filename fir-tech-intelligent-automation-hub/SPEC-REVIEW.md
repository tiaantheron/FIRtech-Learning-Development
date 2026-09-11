# Original specification review — 10 September 2026

## Conclusion and scope

Reviewed `C:/Users/tiaan/Downloads/Spec - Dashboard.docx` (the original Product Requirements Document), the current React source, the supplied `public/firtech_dashboard.xlsx`, and automated tests.

The app is a useful Excel-based Phase 1 management tool, **not compliant with the original production acceptance criteria**. The document calls for a central relational database, authenticated users, server-side permissions, durable shared records and backups. The user's subsequent instructions explicitly limited this implementation to Excel with no database, authentication framework or cloud infrastructure. Those later instructions remain the implementation constraint. This review treats the document as requirements evidence, not permission to introduce that infrastructure.

## Quick fixes implemented

| Spec section | Finding | Implemented change | Remaining limit |
| --- | --- | --- | --- |
| 5.4, 5.2, 10, 15 | Removing people/departments permanently cleared their rows. | Archive/restore actions now retain people, departments, IDs and related history. New/reassigned learning records cannot target archived people; archived department targets require restoration before changes. | Assignment and engagement archival still needs a consistent lifecycle model. Historical records remain visible; time-effective membership and active-only historical attainment policies need definition. |
| 5.7, 10, 17 | Allocation deviations were only warnings and could be written to Excel. | Final Save Excel rejects active departmental allocations that do not total 100%, including small deviations. Intermediate in-memory edits remain possible so reallocations can be completed across departments. | No period-specific allocation versions yet. Downloads outside this application remain editable. |
| 5.8, 5.1 | The reference's qualified PS engagement with `UniqueCustomer=Yes` contributed zero to the unique PS metric. | Imported the unique-customer flag and count distinct qualified PS customers marked unique. | Qualification still relies on supplied status, not configurable eligibility rules or UiPath acceptance evidence. |
| 10 | Training could be completed without a completion date. | Completion now requires a date; the reference Training editor supports AssignedDate and CompletedDate. | Separate exam attempts/results and actual opportunity closing dates still require model changes. |
| 7 | Several straightforward reports were missing; gap reports included achieved rows. | Added outstanding/completed/expiring certification reports, overdue assignments, NPS/CSAT, pipeline by department/owner and leads by department. Gap reports now show outstanding requirements only. | Does not complete every requested report/filter combination; see below. |
| 7, 14, 15 | Every table rendered every row and there was no print workflow. | Tables paginate at 25/50/100 rows; report/audit Print actions, repeated table headings and print styling are included. Printing expands the current table search results across all pages. Exports are not limited to the visible page. | Real large-workbook performance and physical print layout still require acceptance testing. |
| 11 | Audit records were hidden and the detailed workbook format could omit audit logging. | Read-only Audit History page with search, sorting, Excel/CSV export and print. Mutation service rejects Audit edits and creates the Audit sheet when missing. Archive/restore actions are recorded. | Actor remains “Dashboard user,” not an authenticated identity. External workbook edits and undo can alter historical audit state; this is not a tamper-resistant audit ledger. Import is not yet an audited staging transaction. |
| 14 | Saves had no explicit success confirmation; repeat saves could overwrite external changes. | Added status confirmations and byte comparison against the loaded/last-saved version before overwriting a nonempty selected destination. Conflicts stop the write. | Browser fallback downloads cannot inspect a destination. File comparison is not an atomic multi-user lock; another writer can change a file after the check. |
| 5.1, 15 | Source refresh date was not shown; “Conversion” labelled a closed-opportunity win rate. | Overview shows supplied SourceRefreshDate/DataStatus. Renamed the win-rate label to describe its actual calculation. | Lead-to-opportunity conversion still needs a persisted lead/opportunity relationship. |

## Larger changes requiring deliberation

### P0 — Agree the production architecture and scope (sections 3, 9, 12, 13, 16–19)

There is no login, Administrator/Contributor/Viewer separation, department access restriction, server-side authorisation, session expiry, central shared storage, automated backup, cross-device persistence or tested disaster recovery. Refresh requires reloading the saved workbook; unsaved edits remain in memory. Anyone with the local app and workbook can edit its content.

**Decision:** retain a deliberately single-user/offline Excel phase, or explicitly authorise a production phase using FIRtech's approved identity platform, server-side API, database and evidence storage. Do not publicly deploy the current build as a secure internal system. A production design should include optimistic concurrency/version checks, audited identities, backup retention and a tested restore procedure. No provider or infrastructure has been chosen in this review.

### P1 — Reconcile the original figures and roster (sections 5.3, 6, 17)

The reference workbook is marked mock/draft and is incomplete against the document:

- The spec lists 27 distinct named people; the reference contains 11. The full roster, cross-department memberships and two vacancies need business-owner confirmation. Vacancies must become positions, not fictional employee records.
- The reference has 9 Resell detail rows, matching the listed detail requirements, but omits the separately supplied competency total: **65 attained / 5 remaining**.
- The reference has 7 Services detail rows. The spec additionally lists **Automation Solution Architect Professional (1/0)**, **Infrastructure Engineer Professional (0/0)** and **Test Automation Engineer Professional (0/0)**. It also omits the separately supplied Services total: **32 attained / 6 remaining**.
- Approximately USD 600,000 attained against the USD 3 million Resell threshold is an estimate in the source document, not a verified exact transaction total.

**Decision:** confirm the roster and official snapshot with the business owner. Store supplied aggregate scores independently from detail rows and calculated readiness; never sum rows and overwrite UiPath totals. I have not changed the reference workbook or populated missing business records from this review.

### P1 — Expand the learning, people and evidence model (sections 5.4–5.5, 5.8–5.9)

The typed model is substantially narrower than the document. Examples: employee email/employment dates/notes, membership start/end dates, responsible department/pathway per assignment, progress, planned/actual exams, attempts and result dates, credential evidence, assigned/updated actors, engagement submission/acceptance, NPS/CSAT request/response dates, qualification reason, linked opportunities and requirement effective dates. Some fields survive as raw source columns but are not usable in dashboard calculations or specialised workflows.

**Decision:** define the canonical workbook schema for the Excel phase and migration rules before expanding every screen. Decide whether evidence remains links to approved internal storage or becomes uploaded files in a later production phase. Define identity, qualification, evidence and archival rules. Retaining a text field in Excel is not equivalent to implementing its workflow.

### P1 — Define pathway calculation and override governance (sections 5.9, 6, 10–11)

Attained pathway figures are preserved from Excel and the UI uses the supplied statuses. It does not link requirements to specific certification/engagement/revenue records with configurable calculation methods. Readiness is a count of Achieved/Maintain requirements, not UiPath's official scoring algorithm. Overrides require a reason, but lack authenticated author, effective date and supporting evidence. Boolean requirement rendering and manual/calculated modes need an explicit requirement-type model.

**Decision:** specify per-requirement measurement rules, contributing records, eligibility periods and precedence between official snapshot values, calculations and overrides. Keep official supplied totals separate. Add evidence-backed approval and audit semantics without silently changing legacy values.

### P1 — Version targets and reporting periods (sections 5.2, 5.7, 7)

Department targets/allocations are a single current record, not period-versioned. Selecting a quarter filters actuals but uses the unchanged target. Historical certification validity is evaluated today, and undated records remain visible under period filters. The schema has single influencing/delivering department fields rather than multiple contributing departments.

**Decision:** define period-specific targets, carry-over, historical “as of” rules, record dating and many-to-many revenue attribution. Decide whether quarter/year selection uses explicitly recorded targets or a documented allocation method. Do not silently prorate or invent history.

### P1 — Import preview, staging and partial acceptance (section 9)

Imports currently load an entire `.xlsx` workbook, validate it and block calculations for errors. There is no CSV import, per-entity import preview, approve/cancel staging, conflict resolution or acceptance of valid rows. The reference workbook is downloadable, but there is no complete family of per-entity CSV templates.

**Decision:** agree replace versus merge/upsert behaviour, identifier rules, handling of deletes and relationship dependencies, and whether partial acceptance is safe. Preserve the current workbook until the candidate import is explicitly committed and audited.

### P2 — Complete management reporting and reminders (sections 5.6–5.7, 7–8)

Remaining work includes true lead-to-opportunity conversion, average deal value, pipeline/weighted coverage against the revenue gap, forecast definitions, pathway/status report filters, broader employee filtering, and configurable reminders for exams, next actions, evidence requests and revenue behind plan. The new NPS/CSAT report exposes statuses, but does not manage request/response cycles. Current source fields cannot accurately support all requested reports.

**Decision:** define business formulas, notification timing, date windows and ownership; extend the model first. Add in-app reminders before considering email/Teams. No external notifications were sent or scheduled.

### P2 — Production acceptance, accessibility and performance (sections 14, 17, 19)

Automated import/calculation/editing checks exist, but there is no completed authorised-user security test, browser/mobile/keyboard acceptance run, expected-volume performance benchmark, restore test or business-owner sign-off. A successful build does not establish these criteria. Generic source-sheet forms still expose technical column labels rather than fully tailored employee/department pickers.

**Decision:** agree representative workbooks, expected volume, browser/device matrix and named acceptance owners. Create separate test/production datasets and a UAT checklist before calling the system production-ready.

## Verification

Regression tests cover imports, financial calculations, editing/export round trips, preserved reference styles, unique engagement counting, archive/restore, completion dates, allocation-save enforcement, file-conflict rejection, audit protection and report subsets. A server-render test checks that a 1,000-row table initially renders only 25 records. TypeScript and production build checks are run after the changes. Browser interaction, native file-picker behaviour, print appearance and real multi-user concurrency have not been end-to-end tested in this review.

## Recommended order

1. Confirm whether production remains Excel-only or enters the broader architecture described by the original document.
2. Reconcile the roster and official pathway snapshots without replacing supplied scores.
3. Agree a versioned data model for learning, evidence, periods, overrides and attribution.
4. Implement import staging and the remaining workflow/reporting requirements against that model.
5. Perform representative UAT, security/performance checks and a backup/restore exercise before production acceptance.

Verification result: all 30 automated tests passed; the final TypeScript check passed. The local preview responded with HTTP 200. The final production build passed (Vite reported a non-blocking bundle-size warning).


