import { BlobPreconditionFailedError, get, head, put } from "@vercel/blob"

const PATHNAME = "firtech/firtech_dashboard.xlsx"
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") {
      const current = await get(PATHNAME, { access: "private", useCache: false })
      if (!current || current.statusCode !== 200 || !current.stream) return new Response("Workbook has not been set up yet.", { status: 404 })
      return new Response(current.stream, {
        headers: {
          "Content-Type": XLSX,
          "Cache-Control": "no-store",
          ETag: current.blob.etag,
        },
      })
    }

    if (request.method !== "PUT") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, PUT" } })
    const body = await request.arrayBuffer()
    if (!body.byteLength) return new Response("An Excel workbook is required.", { status: 400 })
    if (body.byteLength > 4_500_000) return new Response("The workbook is too large for this deployment's save route.", { status: 413 })

    const suppliedEtag = request.headers.get("if-match")
    let ifMatch: string | undefined = suppliedEtag ?? undefined
    if (!ifMatch) {
      try { ifMatch = (await head(PATHNAME)).etag }
      catch { /* The first save creates the shared workbook. */ }
    }
    const saved = await put(PATHNAME, body, {
      access: "private",
      allowOverwrite: true,
      contentType: XLSX,
      cacheControlMaxAge: 60,
      ...(ifMatch ? { ifMatch } : {}),
    })
    return Response.json({ etag: saved.etag })
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return new Response("The shared workbook was changed by someone else. Refresh before saving again.", { status: 409 })
    console.error("Shared workbook storage failed", error)
    return new Response("The shared workbook could not be saved.", { status: 500 })
  }
}
