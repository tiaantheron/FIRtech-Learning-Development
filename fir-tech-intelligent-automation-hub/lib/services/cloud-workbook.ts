const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export interface CloudWorkbook {
  bytes: ArrayBuffer
  etag: string
}

export async function readCloudWorkbook(): Promise<CloudWorkbook | null> {
  const response = await fetch("/api/workbook", { cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Could not load the shared Excel workbook.")
  const etag = response.headers.get("etag")
  if (!etag) throw new Error("The shared workbook response did not include a revision.")
  return { bytes: await response.arrayBuffer(), etag }
}

export async function writeCloudWorkbook(bytes: ArrayBuffer, etag: string | null) {
  const response = await fetch("/api/workbook", {
    method: "PUT",
    headers: { "Content-Type": XLSX, ...(etag ? { "If-Match": etag } : {}) },
    body: bytes,
  })
  if (response.status === 409) throw new Error("The shared workbook was changed by someone else. Refresh before saving again.")
  if (!response.ok) throw new Error("Could not save the shared Excel workbook.")
  const value = await response.json() as { etag?: string }
  if (!value.etag) throw new Error("The shared workbook save did not return a revision.")
  return value.etag
}
