import { GraphError, downloadWorkbook, getWorkbookRevision, graphConfig, uploadWorkbook } from "../lib/server/graph"

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const MAX_BYTES = 4_500_000

async function requireConfiguredTable(bytes: ArrayBuffer, tableName: string) {
  const { default: ExcelJS } = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.load(bytes) }
  catch { throw new GraphError(422, "The SharePoint file is not a valid .xlsx workbook.") }
  if (!workbook.worksheets.some(sheet => !!sheet.getTable(tableName))) {
    throw new GraphError(422, `The workbook must contain the configured Excel Table "${tableName}".`)
  }
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (process.env.GRAPH_WORKBOOK_ENABLED !== "true") throw new GraphError(503, "SharePoint workbook access is disabled. Protect the deployment and set GRAPH_WORKBOOK_ENABLED=true.")
    const config = graphConfig()
    if (request.method === "GET") {
      const revision = await getWorkbookRevision(config)
      if (request.headers.get("if-none-match") === revision.etag) {
        return new Response(null, { status: 304, headers: { ETag: revision.etag, "Cache-Control": "no-store" } })
      }
      if (revision.size > MAX_BYTES) throw new GraphError(413, "The SharePoint workbook exceeds this deployment's 4.5 MB limit.")
      const current = await downloadWorkbook(config)
      await requireConfiguredTable(current.bytes, config.tableName)
      return new Response(current.bytes, { headers: { "Content-Type": XLSX, "Cache-Control": "no-store", ETag: current.etag } })
    }
    if (request.method !== "PUT") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, PUT" } })
    if (process.env.GRAPH_WORKBOOK_WRITES_ENABLED !== "true") throw new GraphError(403, "SharePoint workbook writes are disabled on this deployment.")
    const expectedEtag = request.headers.get("if-match")
    if (!expectedEtag) throw new GraphError(428, "Refresh the SharePoint workbook before saving.")
    const body = await request.arrayBuffer()
    if (!body.byteLength || body.byteLength > MAX_BYTES) throw new GraphError(413, "An Excel workbook under 4.5 MB is required.")
    await requireConfiguredTable(body, config.tableName)
    const etag = await uploadWorkbook(config, body, expectedEtag)
    return Response.json({ etag }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const status = error instanceof GraphError ? error.status : 502
    if (!(error instanceof GraphError)) console.error("SharePoint workbook operation failed", error)
    return new Response(error instanceof Error ? error.message : "SharePoint workbook operation failed.", { status, headers: { "Cache-Control": "no-store" } })
  }
}
