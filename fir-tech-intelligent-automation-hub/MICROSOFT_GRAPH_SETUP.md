# SharePoint workbook setup

The application uses one `.xlsx` file in SharePoint as its shared source. Vercel downloads and replaces that file through Microsoft Graph using an Entra application and client credentials. The browser talks only to `/api/workbook`; it never receives the client secret or Graph access token. The existing dashboard still parses and edits the workbook, so this is **whole-file synchronization**, not Graph Excel Table row CRUD.

Microsoft's [Excel Table row APIs](https://learn.microsoft.com/en-us/graph/api/table-list-rows?view=graph-rest-1.0) do not support application permissions. Direct Table API CRUD would require delegated Microsoft sign-in and a different authentication flow. Graph [file downloads](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0) and [file replacements](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0) do support app-only access. Do not configure a production tenant expecting client credentials to work with `/workbook/tables/.../rows`.

## 1. Prepare the workbook

1. In the intended SharePoint site, upload a **copy** of `public/firtech_dashboard.xlsx` or the app's exported, validated workbook. Keep the original as a backup. The supplied reference has nine worksheets and **does not contain Excel Tables**.
2. Open the SharePoint copy in Excel. Select the Settings data range including its header row, choose **Insert → Table**, confirm **My table has headers**, and name the table `FIRtechData` under **Table Design → Table Name**. Set `TABLE_NAME=FIRtechData` in Vercel. This named table is a configuration check; the current dashboard still needs the other worksheets in the documented reference or 14-sheet detailed format.
3. Keep the worksheet names and headers intact. For a future direct Table API migration, convert each business sheet to its own named Excel Table, with a stable unique ID column: `DepartmentID`, `PersonID`, `AssignmentID`, `CertificationId`, `LeadId`, `OpportunityId`, `RevenueId`, `EngagementID`, and `AuditID` as applicable. Do not reuse an ID after deletion. Keep dates as dates or `YYYY-MM-DD`, monetary values numeric, and original currency plus conversion metadata in separate columns.
4. Save and close Excel before the first connection. Check that the account used by staff can edit the file in SharePoint.

For the supplied nine-sheet layout, recommended future table names and stable keys are:

| Worksheet | Suggested table | Stable key |
| --- | --- | --- |
| Settings | `FIRtechData` | `Setting` |
| Departments | `FIRtechDepartments` | `DepartmentID` |
| People | `FIRtechPeople` | `PersonID` |
| Memberships | `FIRtechMemberships` | `MembershipID` |
| Requirements | `FIRtechRequirements` | `RequirementID` |
| Training | `FIRtechTraining` | `AssignmentID` |
| Opportunities | `FIRtechOpportunities` | `RecordID` |
| Engagements | `FIRtechEngagements` | `EngagementID` |
| Audit | `FIRtechAudit` | `AuditID` |

The current file-sync route requires only `FIRtechData`; creating the other tables prepares the workbook for a later direct Table API design but does not change how this version edits records.

## 2. Register the Entra application

1. In **Microsoft Entra admin center → App registrations → New registration**, create a single-tenant application. Copy its **Directory (tenant) ID** to `TENANT_ID` and **Application (client) ID** to `CLIENT_ID`.
2. Under **Certificates & secrets**, create a client secret. Copy its **value** once to `CLIENT_SECRET` in Vercel. Do not commit it, put it in a `VITE_` variable, or paste it into the workbook.
3. Under **API permissions → Add a permission → Microsoft Graph → Application permissions**, grant `Sites.ReadWrite.All`, then have an administrator grant tenant-wide consent. Microsoft lists this as an application permission for [file replacement](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0). It is broad: restrict deployment access and review with your Microsoft 365 administrator before production use. No delegated Excel Table permission is needed for this file-content design.
4. Record the secret's expiry date and rotate it before expiry.

## 3. Find the SharePoint IDs

Use Microsoft Graph Explorer with a Microsoft 365 account that can access the workbook, or have the tenant administrator run these requests. Graph Explorer uses a **delegated** token for discovery; the deployed app still uses client credentials.

1. For a site URL such as `https://contoso.sharepoint.com/sites/FIRtech`, request `GET https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/FIRtech`. Copy `id` to `SITE_ID`.
2. Request `GET https://graph.microsoft.com/v1.0/sites/{SITE_ID}/drives`. Find the document library containing the workbook and copy its `id` to `DRIVE_ID`.
3. Request `GET https://graph.microsoft.com/v1.0/drives/{DRIVE_ID}/root:/path/to/firtech_dashboard.xlsx` (URL-encode path segments). Copy the returned `id` to `FILE_ID`.
4. Verify `GET https://graph.microsoft.com/v1.0/drives/{DRIVE_ID}/items/{FILE_ID}` returns a file with an `.xlsx` name and an `eTag`. A `404` usually means the site, drive, file, or permissions are wrong.

## 4. Configure Vercel

Set the Vercel project Root Directory to `fir-tech-intelligent-automation-hub`. Add the following to **Project Settings → Environment Variables** for each environment that will use the SharePoint workbook, then redeploy:

| Variable | Purpose |
| --- | --- |
| `TENANT_ID` | Entra directory ID |
| `CLIENT_ID` | Entra application ID |
| `CLIENT_SECRET` | Server-only Entra client secret |
| `SITE_ID` | SharePoint site ID for the configured workbook |
| `DRIVE_ID` | Document-library drive ID |
| `FILE_ID` | Existing workbook drive-item ID |
| `TABLE_NAME` | Name of an Excel Table present in that workbook, e.g. `FIRtechData` |
| `GRAPH_WORKBOOK_ENABLED` | Set to `true` only after restricting deployment access; otherwise API returns 503 |
| `GRAPH_WORKBOOK_WRITES_ENABLED` | Set to `true` only after restricting deployment access and testing reads; otherwise saves return 403 |
| `VITE_REFRESH_INTERVAL_MS` | Optional browser poll interval; default `30000`, minimum `5000` |

Do not prefix the credentials or IDs with `VITE_`. The only browser-visible setting above is the poll interval. Remove the old Vercel Blob connection and `BLOB_READ_WRITE_TOKEN` after validating the SharePoint setup. The Graph route returns a setup error if required variables are missing; it does not create a new SharePoint workbook for you. Local Vite development can still open the bundled workbook because it does not run the Vercel API route.

The current workbook-based roles are enforced in the browser, **not** by the Vercel write endpoint. Before setting either enable flag, restrict access to the entire deployment using an organization-only access layer, and verify an unauthenticated visitor cannot reach `/api/workbook`. Enable reads first, test, then enable writes. The flags are a deployment gate, **not user authorization**. Server-side identity and authorization remain required for a production multi-user security boundary. The workbook and its Users/Evidence sheets are delivered to the browser in this architecture.

## 5. Verify both directions

1. Open the deployed app. Confirm the SharePoint-connected message and that its dashboard reflects the SharePoint workbook. A missing configured Table or invalid workbook produces an actionable error instead of switching to another cloud store.
2. Sign in to the app as an authorized editor, change a test record, and check SharePoint Excel for that change and its audit entry. The app submits the edited workbook with the revision it loaded; a stale revision should return a conflict rather than overwrite another edit.
3. Change a different test record directly in Excel and save it. With no unsaved app edits, wait up to the refresh interval, or click **Refresh**. Confirm the new value appears in the dashboard. The app skips automatic refresh while its edits are pending to avoid discarding them.
4. Create, edit, and remove a test record through the app; inspect the exported workbook and audit history. Restore or remove test data afterward using the app's normal controls.
5. In Vercel logs, investigate any 429/503 responses. The service retries safe Graph reads and respects `Retry-After`. The app uses conditional ETags to avoid downloading unchanged workbooks. Polling every 30 seconds is a starting point; increase the interval if the tenant is throttled.

## Limits and next architecture decision

- This solution replaces the **whole file** through Graph. It does not call Graph Table row CRUD, and the existing parser/editor still accesses worksheet cells. `TABLE_NAME` confirms a named table exists but does not make every dashboard entity table-only. Meeting strict Table-only CRUD requires a delegated-token redesign across all business tables.
- File replacement can conflict with someone editing the workbook at the same time. The upload session sends `If-Match`; the app shows a conflict and retains pending edits when SharePoint reports one. It does not merge simultaneous edits.
- App-only replacement does not support files protected with certain sensitivity labels; Microsoft requires delegated permissions for those files. The route currently caps workbooks at 4.5 MB. It also requires the workbook to exist in SharePoint before deployment.
- There is no live tenant configured in this repository, so the integration can be tested with mocked Graph responses and local workbook tests, but the final SharePoint round trip must be verified in your tenant after the manual setup above.
