import { assertUnchangedFile } from "./save-checks"

export interface WorkbookHandle {
  name: string
  getFile(): Promise<File>
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>
  createWritable(): Promise<{ write(data: ArrayBuffer): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>
}
export const excelTypes = [{ description: "Excel workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }]
export function sourcePicker() {
  return (window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<WorkbookHandle[]> }).showOpenFilePicker
}

// Store only the browser-issued handle, never workbook data or an inferred path.
export async function rememberedSource(value?: WorkbookHandle | null): Promise<WorkbookHandle | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("firtech-file-connection", 1)
    request.onupgradeneeded = () => request.result.createObjectStore("connection")
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("connection", value === undefined ? "readonly" : "readwrite")
      const store = transaction.objectStore("connection")
      const request = value === undefined ? store.get("source") : value === null ? store.delete("source") : store.put(value, "source")
      transaction.oncomplete = () => resolve(value === undefined ? request.result ?? null : value)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}

export async function writeSource(handle: WorkbookHandle, expected: ArrayBuffer, next: ArrayBuffer) {
  if (await handle.queryPermission({ mode: "readwrite" }) !== "granted") throw new Error("File access needs permission. Click Save Excel to reconnect and save your pending changes.")
  assertUnchangedFile(await (await handle.getFile()).arrayBuffer(), expected)
  const writer = await handle.createWritable()
  try { await writer.write(next); await writer.close() }
  catch (error) { await writer.abort().catch(() => {}); throw error }
}
