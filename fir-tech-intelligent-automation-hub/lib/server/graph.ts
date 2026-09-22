/** Microsoft Graph transport for one SharePoint workbook. Never import this module from the browser. */
const GRAPH = "https://graph.microsoft.com/v1.0"
const RETRYABLE = new Set([429, 502, 503, 504])
const REQUEST_TIMEOUT_MS = 6_000

export class GraphError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export interface GraphConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  siteId: string
  driveId: string
  fileId: string
  tableName: string
}

export function graphConfig(env: NodeJS.ProcessEnv = process.env): GraphConfig {
  const required = ["TENANT_ID", "CLIENT_ID", "CLIENT_SECRET", "SITE_ID", "DRIVE_ID", "FILE_ID", "TABLE_NAME"] as const
  const missing = required.filter(key => !env[key]?.trim())
  if (missing.length) throw new GraphError(503, `SharePoint workbook is not configured: ${missing.join(", ")}.`)
  return {
    tenantId: env.TENANT_ID!, clientId: env.CLIENT_ID!, clientSecret: env.CLIENT_SECRET!,
    siteId: env.SITE_ID!, driveId: env.DRIVE_ID!, fileId: env.FILE_ID!, tableName: env.TABLE_NAME!,
  }
}

let tokenCache: { key: string; token: string; expires: number } | null = null
let tokenPromise: Promise<string> | null = null

async function timedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) throw new GraphError(504, "SharePoint did not respond in time. You can upload a compatible workbook and try again later.")
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function accessToken(config: GraphConfig): Promise<string> {
  const key = `${config.tenantId}:${config.clientId}`
  if (tokenCache?.key === key && Date.now() < tokenCache.expires) return tokenCache.token
  if (tokenPromise) return tokenPromise
  tokenPromise = (async () => {
    const response = await timedFetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    })
    if (!response.ok) throw new GraphError(502, `Microsoft sign-in failed (${response.status}). Check the Entra application and consent.`)
    const body = await response.json() as { access_token?: string; expires_in?: number }
    if (!body.access_token) throw new GraphError(502, "Microsoft sign-in returned no access token.")
    tokenCache = { key, token: body.access_token, expires: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 60) * 1000 }
    return body.access_token
  })()
  try { return await tokenPromise } finally { tokenPromise = null }
}

function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)) }
function retryDelay(response: Response, attempt: number) {
  const header = response.headers.get("retry-after")
  const seconds = header ? Number(header) : NaN
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 30_000)
  const date = header ? Date.parse(header) : NaN
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 30_000)
  return Math.min(500 * 2 ** attempt, 4000)
}

async function request(config: GraphConfig, path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken(config)
    const response = await timedFetch(`${GRAPH}${path}`, {
      ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers },
    })
    if (retry && RETRYABLE.has(response.status) && attempt < 1) { await delay(Math.min(retryDelay(response, attempt), 1_000)); continue }
    if (!response.ok) {
      if (response.status === 412) throw new GraphError(409, "The SharePoint workbook changed. Refresh before saving again.")
      if (response.status === 404) throw new GraphError(502, "The configured SharePoint workbook was not found.")
      throw new GraphError(response.status === 429 ? 503 : 502, `Microsoft Graph returned ${response.status}.`)
    }
    return response
  }
}

function itemPath(config: GraphConfig) {
  return `/drives/${encodeURIComponent(config.driveId)}/items/${encodeURIComponent(config.fileId)}`
}

type Revision = { etag: string; name: string; size: number }
let revisionCache: { key: string; value: Revision; expires: number } | null = null
let revisionInFlight: { key: string; promise: Promise<Revision> } | null = null

export async function getWorkbookRevision(config: GraphConfig, fresh = false): Promise<Revision> {
  const key = `${config.siteId}:${config.driveId}:${config.fileId}`
  if (!fresh && revisionCache?.key === key && Date.now() < revisionCache.expires) return revisionCache.value
  if (revisionInFlight?.key === key) return revisionInFlight.promise
  const promise = (async () => {
    const response = await request(config, `${itemPath(config)}?$select=id,name,eTag,size,file,parentReference`)
    const item = await response.json() as { eTag?: string; name?: string; size?: number; file?: object; parentReference?: { siteId?: string } }
    if (!item.eTag || !item.file || !item.name?.toLowerCase().endsWith(".xlsx")) throw new GraphError(502, "The configured SharePoint item is not an Excel workbook.")
    if (item.parentReference?.siteId && item.parentReference.siteId !== config.siteId) throw new GraphError(502, "The configured workbook does not belong to SITE_ID.")
    const value = { etag: item.eTag, name: item.name, size: item.size ?? 0 }
    revisionCache = { key, value, expires: Date.now() + 2000 }
    return value
  })()
  revisionInFlight = { key, promise }
  try { return await promise } finally { if (revisionInFlight?.promise === promise) revisionInFlight = null }
}

export async function downloadWorkbook(config: GraphConfig, revision?: Revision) {
  // The preceding metadata lookup supplies the revision used for this download.
  // This avoids several Graph round trips during a serverless page load.
  const current = revision ?? await getWorkbookRevision(config)
  const response = await request(config, `${itemPath(config)}/content`)
  const bytes = await response.arrayBuffer()
  return { bytes, etag: current.etag, name: current.name }
}

export async function uploadWorkbook(config: GraphConfig, bytes: ArrayBuffer, expectedEtag: string) {
  if (!expectedEtag) throw new GraphError(428, "A workbook revision is required before saving.")
  // Upload sessions document If-Match for conflict protection; the simple PUT route does not.
  const sessionResponse = await request(config, `${itemPath(config)}/createUploadSession`, {
    method: "POST", headers: { "Content-Type": "application/json", "If-Match": expectedEtag },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
  })
  const session = await sessionResponse.json() as { uploadUrl?: string }
  if (!session.uploadUrl?.startsWith("https://")) throw new GraphError(502, "Microsoft Graph returned no upload session URL.")
  const response = await timedFetch(session.uploadUrl, {
    method: "PUT", headers: { "Content-Length": String(bytes.byteLength), "Content-Range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` }, body: bytes,
  })
  if (response.status === 412 || response.status === 409) throw new GraphError(409, "The SharePoint workbook changed. Refresh before saving again.")
  if (!response.ok) throw new GraphError(502, `SharePoint workbook upload failed (${response.status}).`)
  if (response.status === 202) throw new GraphError(502, "SharePoint accepted only part of the workbook upload. Save was not confirmed.")
  const item = await response.json() as { eTag?: string }
  revisionCache = null
  if (!item.eTag) throw new GraphError(502, "SharePoint did not confirm the workbook's new revision.")
  return item.eTag
}
