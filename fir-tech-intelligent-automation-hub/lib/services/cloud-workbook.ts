const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export interface CloudWorkbook {
  bytes: ArrayBuffer
  etag: string
}

export async function readCloudWorkbook(etag?: string): Promise<CloudWorkbook | null> {
  const response = await fetch("/api/workbook", { cache: "no-store", headers: etag ? { "If-None-Match": etag } : {} })
  if (response.status === 404 || response.status === 304) return null
  if (!response.ok) throw new Error((await response.text()) || "Could not load the SharePoint workbook.")
  // Local Vite serves api/workbook.ts as a JavaScript module. Only a real workbook
  // response should override the bundled default file.
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes(XLSX)) return null
  const responseEtag = response.headers.get("etag")
  if (!responseEtag) throw new Error("The SharePoint workbook response did not include a revision.")
  return { bytes: await response.arrayBuffer(), etag: responseEtag }
}

export async function writeCloudWorkbook(bytes: ArrayBuffer, etag: string | null) {
  const response = await fetch("/api/workbook", {
    method: "PUT",
    headers: { "Content-Type": XLSX, ...(etag ? { "If-Match": etag } : {}) },
    body: bytes,
  })
  if (response.status === 409 || response.status === 412) throw new Error("The SharePoint workbook changed. Refresh before saving again.")
  if (!response.ok) throw new Error((await response.text()) || "Could not save the SharePoint workbook.")
  const value = await response.json() as { etag?: string }
  if (!value.etag) throw new Error("The shared workbook save did not return a revision.")
  return value.etag
}
