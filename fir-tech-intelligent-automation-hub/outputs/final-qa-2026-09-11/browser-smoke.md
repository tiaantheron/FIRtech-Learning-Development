# Browser smoke evidence — 11 September 2026

Environment: local Vite app at http://127.0.0.1:5173, available Codex in-app browser, normal desktop width (1280px). No connected desktop Chrome/Edge browser was available. Tests operated on in-memory workbook copies. The reference source was separately checked for accidental QA records.

| Scenario | Result and observed evidence |
| --- | --- |
| Default open | Passed: Viewer, reference loaded automatically, mock/draft notice, write/export disabled. 7 departments, 11 people; separate Resell 6/9 and Services 4/7 progress. |
| Optional local profile | Passed: admin/admin opened Administrator controls. Visible notice now says local workbook role only, no server authentication. |
| Revenue validation | Passed: QA-BROWSER-REV-0911 Amount -100 rejected with Revenue row 2, Amount: Value must not be negative. |
| Revenue add | Passed: USD 100, rate 18, reporting ZAR, rate/recognition dates 2026-09-11, source QA mock rate. Derived amount R1,800; attained R1,800; remaining R2,998,200. |
| Revenue edit and stable ID | Passed: existing ID field disabled; amount 200 changed attained to R3,600. Service test independently rejects changing ID. |
| Undo/audit | Passed: undo restored R1,800 and Audit retained Add, Update and new Undo rows. Actor was System administrator, not a verified identity. |
| People search/sort | Passed: search Moss returned PER-002 only; FullName sortable header responded. |
| Archive/restore | Passed after fix: inline confirmation completed archive of PER-002; Restore returned it; Audit contained Archive and Restore for the same key. Native window.confirm had previously frozen a tab, prompting the inline fix. |
| Report filters | Passed: Pipeline department Investec & Bryte returned two opportunities; employee Kyle Govender reduced to Investec, value R850,000 and weighted R467,500. |
| Desktop table containment | Passed: measured document width 1265px in 1280px viewport without body overflow. Wide Audit table scrolled internally. Later compact Audit table verified in DOM with six summary columns plus expandable View changes details. |
| Download pending-state safety | Passed: requested workbook download left Pending changes visible. Edited Notes again, then attempted acknowledgement; rejected with The workbook changed after the download request. Download the latest version before confirming. |
| App console | No warning/error entries returned during the completed revenue/download smoke checks. Tool/native-dialog timeouts below are separate. |
| Actual workbook download and UI reload | Blocked: download event waits timed out; no corresponding artifact verified in Downloads. Ordinary Import a copy file-chooser event also timed out. Successful serialization/disk reload is covered by automated tests, not claimed as browser completion. |
| Report native CSV download | Blocked: event wait timed out. Actual CSV blob contents and Excel report disk read-back are verified by automated tests. |
| Full responsive/accessibility/picker matrix | Not completed: targeted desktop smoke only. Date inputs were exercised through the native date picker after direct fill did not commit a value. |

During the interrupted session an earlier temporary browser tab disappeared. Fresh tabs were used and disk changes preserved. A native dialog and later file-chooser attempt left other temporary tabs unresponsive; no repeated destructive recovery was attempted. None of these browser copies was used to overwrite the reference. `source-check.json` records zero temporary QA identifiers and only the original Audit row.

Next manual acceptance: use a disposable workbook copy in a supported desktop browser to verify connected autosave and download/import separately. Inspect actual saved Revenue cells and Audit in Excel, reload through the UI, and confirm the same record/metric/audit. A UI download notice or user acknowledgement alone is not evidence that an operating-system file was created.
