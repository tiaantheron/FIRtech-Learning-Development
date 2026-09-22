import { test } from "node:test"
import assert from "node:assert/strict"
import { GraphError, downloadWorkbook, graphConfig, uploadWorkbook, type GraphConfig } from "../lib/server/graph"
import workbookHandler from "../api/workbook"
import { readFileSync } from "node:fs"

const config: GraphConfig = {
  tenantId: "tenant", clientId: "graph-test", clientSecret: "private-test-value", siteId: "site",
  driveId: "drive", fileId: "file", tableName: "FIRtechData",
}

test("Graph configuration requires server-side SharePoint settings", () => {
  assert.throws(() => graphConfig({}), /TENANT_ID.*CLIENT_ID.*TABLE_NAME/)
})

test("app-only transport reads a stable workbook revision and uploads with If-Match", async () => {
  const originalFetch = globalThis.fetch
  const calls: { url: string; init?: RequestInit }[] = []
  const file = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.includes("oauth2/v2.0/token")) return Response.json({ access_token: "server-token", expires_in: 3600 })
    if (url === "https://upload.example/session") return Response.json({ eTag: '"new"' })
    if (url.endsWith("/createUploadSession")) return Response.json({ uploadUrl: "https://upload.example/session" })
    if (url.endsWith("/content")) return new Response(file)
    return Response.json({ eTag: '"original"', name: "firtech.xlsx", size: file.byteLength, file: {} })
  }
  try {
    const workbook = await downloadWorkbook(config)
    assert.equal(workbook.etag, '"original"')
    assert.deepEqual(new Uint8Array(workbook.bytes), file)
    const saved = await uploadWorkbook(config, workbook.bytes, workbook.etag)
    assert.equal(saved, '"new"')
    const upload = calls.find(call => call.url.endsWith("/createUploadSession"))!
    assert.equal((upload.init?.headers as Record<string, string>)["If-Match"], '"original"')
    assert.equal(calls.find(call => call.url === "https://upload.example/session")?.init?.method, "PUT")
    assert.ok(!calls.some(call => call.url.includes("server-token")))
  } finally { globalThis.fetch = originalFetch }
})

test("Graph upload refuses an unconditional overwrite", async () => {
  await assert.rejects(() => uploadWorkbook(config, new ArrayBuffer(4), ""), (error: unknown) => error instanceof GraphError && error.status === 428)
})

test("SharePoint API is disabled until deployment protection is configured", async () => {
  const previous = process.env.GRAPH_WORKBOOK_ENABLED
  delete process.env.GRAPH_WORKBOOK_ENABLED
  try { assert.equal((await workbookHandler(new Request("https://app.example/api/workbook"))).status, 503) }
  finally { if (previous === undefined) delete process.env.GRAPH_WORKBOOK_ENABLED; else process.env.GRAPH_WORKBOOK_ENABLED = previous }
})

test("SharePoint API returns the source quickly and leaves full schema validation to the client", async () => {
  const previousFetch = globalThis.fetch
  const keys = ["TENANT_ID", "CLIENT_ID", "CLIENT_SECRET", "SITE_ID", "DRIVE_ID", "FILE_ID", "TABLE_NAME", "GRAPH_WORKBOOK_ENABLED"] as const
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const values = ["tenant", "api-table-test", "secret", "site", "api-drive", "api-file", "FIRtechData", "true"]
  keys.forEach((key, i) => { process.env[key] = values[i] })
  const bytes = readFileSync("public/firtech_dashboard.xlsx")
  globalThis.fetch = async input => {
    const url = String(input)
    if (url.includes("oauth2/v2.0/token")) return Response.json({ access_token: "token", expires_in: 3600 })
    if (url.endsWith("/content")) return new Response(bytes)
    return Response.json({ eTag: '"revision"', name: "firtech_dashboard.xlsx", size: bytes.length, file: {}, parentReference: { siteId: "site" } })
  }
  try {
    const response = await workbookHandler(new Request("https://app.example/api/workbook"))
    assert.equal(response.status, 200)
    assert.equal((await response.arrayBuffer()).byteLength, bytes.byteLength)
  } finally {
    globalThis.fetch = previousFetch
    keys.forEach(key => { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] })
  }
})
