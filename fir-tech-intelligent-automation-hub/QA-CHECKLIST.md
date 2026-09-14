# FIRtech delivery QA — 11 September 2026

Status: **Partial acceptance for the Excel-backed prototype.** The UI add/edit/validation/audit workflow passed targeted smoke tests. Automated workbook serialization and disk reload passed. The available in-app browser did not complete a native download/file-picker round trip, so that release gate remains open. This is not a production-security sign-off.

## Acceptance checklist

Done means implemented and supported by the stated evidence within the local Excel scope. Partial means a material limitation or incomplete acceptance coverage remains. Blocked identifies an environment-dependent test that could not complete. Out of Scope identifies production infrastructure excluded from this delivery.

| Requirement | Status | Evidence and qualification |
| --- | --- | --- |
| Overview separates Resell Diamond and Services Gold | Done | Separate overview progress, observed at 6/9 (67%) and 4/7 (57%) on the reference. `workbook.test.ts` verifies exact pathway totals. |
| Manage Department, People, Membership, Requirements, Training, Opportunity, Revenue and Engagement through UI | Done | Section worksheet editors route through validated workbook mutations. Revenue and People exercised in browser; shared mutation lifecycle covered by `editing.test.ts`. This does not mean every form received exhaustive browser testing. |
| Add, edit, archive/restore, validation, undo and Excel export for core records | Partial | Add/edit/reject/undo passed for Revenue; People archive/restore passed. Archive/restore exists only for People and Departments. Other records use removal plus same-session undo. Workbook export/reload passes automated disk tests; native browser handoff is Blocked below. |
| Stable IDs and audit in every editable workflow | Partial | Existing editor keys are immutable; new ID fields receive UUID defaults. Mutation, account and evidence tests verify audit. Undo now retains earlier audit and appends Undo. Legacy workbook relationships still contain names resolved at import; full migration to explicit ID foreign keys remains. Audit cannot establish a trusted identity or detect external Excel edits. |
| Calculations update from underlying records, no placeholder KPIs | Done | Revenue UI change USD 100 at rate 18 produced R1,800, then USD 200 produced R3,600. Source-driven metrics tested in `workbook.test.ts`; opportunity value is explicitly distinguished from recorded revenue. Source requirements/overrides are workbook inputs, not independently verified attainment. |
| Revenue targets, attained, remaining, ownership, currency and allocation safeguards | Done | Detailed Revenue sheet added to reference. Ownership attributed once; incomplete FX and negative values rejected; allocation totals must be 100% before file save. `editing.test.ts`, `spec-review.test.ts`, `workbook.test.ts`, `delivery.test.ts`. Original currency, reporting currency, rate, date and source retained. |
| Pipeline leads/opportunities, stage, weighted value, status and conversion | Done | Dedicated Leads sheet added; existing section editor exposes Leads and Opportunities. Stage override and currency separation tests pass. Browser default pipeline total R1,570,000, weighted R695,500; report owner/department filters checked. |
| Training/certifications outstanding, overdue, expired and expiring | Done | Detailed Certifications sheet added. Date-relative `delivery.test.ts` covers all states; completed training requires completion date. No certificate verification service is claimed. |
| Qualifying customer and professional-services engagements distinguished | Done | `spec-review.test.ts` checks source UniqueCustomer qualification and exclusion of unqualified activity; `workbook.test.ts` checks department attribution without repeating company totals. Qualification remains user-entered. |
| Reports promised filters and Excel/CSV exports | Partial | Department, period and supported employee selections feed report builders and export rows; browser department/employee filtering passed. CSV escaping and actual Excel report disk read-back pass `report-export.test.ts`. Table text search/sort/pagination affects display, not export selection. Native download completion remains unverified. |
| Validation Console blocks invalid saves with actionable messages | Done | Mutation rejects malformed rows before commit; save gate rejects invalid allocation totals. Console now includes the same final allocation failure. Browser negative revenue identifies sheet, row and Amount; validation test coverage includes dates, relationships, duplicate IDs and FX metadata. Intermediate allocation edits can remain pending while allocations are balanced; file save stays blocked. |
| Empty, loading, error and download-mode states understandable | Partial | Default loads automatically; empty reports and loading/errors have messages; import-copy and retry-default recovery provided. Download request no longer clears pending edits; stale acknowledgement rejected in browser. Native pickers/discard confirmations and remembered-handle recovery need target-browser testing. |
| Searchable, sortable, paginated desktop tables | Done | People search/sort checked in browser; 25-row default and pagination covered in `table.test.ts`. 1280px desktop check found contained table scrolling, no page overflow. Audit snapshots moved into expandable Details. Wide record tables still require horizontal scrolling. |
| Full automated suite, TypeScript, production build and browser smoke | Partial | 38/38 tests, TypeScript exit 0, Vite build exit 0. Targeted browser smoke executed. Native download/file-chooser events timed out; complete real-file browser acceptance remains Blocked. No full mobile, screen-reader or cross-browser matrix performed. |
| Final QA checklist, evidence, limitations and risks | Done | This file and `outputs/final-qa-2026-09-11/` contain current evidence. Supersedes earlier acceptance claims, not the historical artifacts themselves. |

## Completed fixes

- Added empty schema-correct Leads, Revenue and Certifications sheets to the default workbook, preserving its supplied rows and formatting. Missing numbers still normalize to zero; optional text remains blank.
- Protected existing record IDs/keys and retained audit history across undo.
- Replaced record archive/remove native confirmation with an inline confirmation; restore remains audited.
- Made fallback download status honest: pending edits remain until the user verifies and acknowledges the saved file; subsequent edits invalidate an old acknowledgement.
- Added an ordinary import-copy route and default-load retry; allocation save errors now appear in Validation Console.
- Clarified local-role limitations, mock/draft source labels and revenue wording. Report/audit export rows include source status.
- Escaped CSV headers as well as values and reduced Audit table clutter using expandable snapshots.

## Test evidence

| Evidence | Result |
| --- | --- |
| `outputs/final-qa-2026-09-11/tests.txt` | 38 passed, 0 failed, 0 skipped. Includes four new delivery/report-export regression cases. |
| `outputs/final-qa-2026-09-11/typecheck.txt` | TypeScript exit 0. |
| `outputs/final-qa-2026-09-11/build.txt` | Vite build exit 0. Large bundle warnings remain; build success is not a performance benchmark. |
| `outputs/final-qa-2026-09-11/browser-smoke.md` | Actual UI scenarios, observations and blocked native file round trip. |
| `outputs/final-qa-2026-09-11/source-check.json` | Reference retains 7 departments, 11 people, 4 opportunities, 2 engagements and 1 original audit row. New detail sheets are empty; no temporary QA identifiers found. |
| `tests/delivery.test.ts` | Writes mutated workbook to a temporary disk file, reloads it, asserts Revenue ConvertedAmount 13,500 and audit RecordID, then asserts undo restores 500 and retains audit. |
| `tests/file-connection.test.ts` | Simulated source handles cover successful writes, stale versions, revoked permissions and write/close failures. These are not OS browser-picker tests. |

Validation commands used the bundled Node runtime with `tsx --test tests/*.test.ts`, `tsc --noEmit`, and `vite build`. No deployment was performed. Browser test records were confined to in-memory copies. The interruption did not introduce QA transactions into the reference workbook; the resumed checks passed. An unrelated deleted Excel lock file in the working tree was left untouched.

## Workplan reconciliation

Reviewed `C:\Users\tiaan\Downloads\firtech_ia_hub_8_hour_workplan_tracker.xlsx` as a delivery reference, alongside the app, schema, tests and original-spec assessment in `SPEC-REVIEW.md`. Historical tracker dates/statuses were not rewritten.

| Tracker items | Current disposition |
| --- | --- |
| T01 scope, T02 shell | Done within Excel-backed scope. |
| T03 relational database migrations | Out of Scope; workbook structures remain the persistence format. |
| T04 spec seed | Partial: explicit mock/draft source retained; business owner must approve actual roster, requirements and attained values. |
| T05 core CRUD, T07 record actions/audit | Partial: local lifecycle works; limited archive coverage and legacy name references remain. Persistence after refresh requires successful saved-file reload. |
| T06 overview/calculations | Done with workbook-input qualifications above. |
| T08 functional gate, T09 blocker closure | Partial: UI/service gates pass; native file round trip still Blocked in available browser. |
| T10 visual/states, T11 reports | Partial: desktop pass and recovery improvements; cross-browser checks/export caveat remain. |
| T12 validation, T13 learning/risk cues | Done for existing Excel calculations and explicit user-entered data. No automated external reminders/verification. |
| T14 final QA | Partial: automation/build/type checks pass; wider accessibility/device/performance review pending. |
| T15 handover | Done: README, current checklist and test evidence. |
| T16 release | Partial: desktop save/reload acceptance and business approval required before relying on the workbook operationally. |

## Exact remaining gaps and risks

1. **Blocked acceptance test:** in a supported desktop browser, sign in locally, connect a disposable workbook copy, add/edit Revenue, observe autosave, close/reopen the file, and verify amount, conversion and audit. Also test download-only export/import, permission revocation and remembered-handle recovery. In-app browser events timed out; no actual downloaded artifact was verified. Keep a backup during this acceptance test.
2. **Lifecycle/model:** decide archive semantics for financial, membership, requirement, training and engagement records, then implement a consistent archived-record policy and migration to ID foreign keys. Do not silently exclude historical financial data.
3. **Export semantics:** report exports use report-level filters, not table search/order/page. Add synchronized export filtering if that behavior is required. Empty reports currently disable export.
4. **Data approval:** supplied data is mock/draft; zero-valued empty revenue/certification sheets are not evidence of actual attainment. Confirm roster, ownership, requirements, rates and allocations with the business owner.
5. **Client persistence:** default file is a served static asset. Edits stay in memory until a connected native file write or verified download; remembering a browser handle is not a server file path. Conflict detection compares bytes but is not atomic multi-user locking. External workbook changes can bypass validation and auditing.
6. **Coverage/performance:** all core forms share the tested editor but were not individually exhaustively smoke-tested. Complete keyboard/screen-reader/mobile and target-browser checks. Large Excel/chart bundles remain; performance under large real workbooks has not been accepted.

## Production capabilities explicitly Out of Scope

Authenticated identities and secure RBAC; central relational database and shared persistence; server authorization, backups and durable audit; atomic concurrency/conflict resolution; enterprise identity/CRM integration; automated FX feeds; certificate verification; customer-facing access. The workbook's admin/admin account and local permission controls are demonstration/local workflow features, not security boundaries. Audit rows remain editable outside the app.

**Single most important production next step:** establish a trusted server boundary with FIRtech identity and authorization on every data operation, keeping the workbook and credentials private. Excel can remain the initial storage format behind that boundary; shared-use durability and concurrency then need explicit design before production rollout.
