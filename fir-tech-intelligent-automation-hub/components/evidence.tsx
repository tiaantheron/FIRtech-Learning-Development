import { useMemo, useState } from "react"
import { useWorkbook, useWorkbookData } from "@/lib/workbook-context"
import { readEditorSheet } from "@/lib/services/workbook-editor"
import { rowAllowed, canEditSheet } from "@/lib/services/permissions"
import { Button } from "./ui/button"
const TYPES = ["application/pdf", "image/png", "image/jpeg", "text/plain"]
export function Evidence() {
  const { buffer, user, result, editRecord, loading } = useWorkbook()
  const data = useWorkbookData(false)
  const [department, setDepartment] = useState(""), [recordId, setRecordId] = useState(""), [notes, setNotes] = useState(""), [file, setFile] = useState<File | null>(null), [error, setError] = useState("")
  const rows = useMemo(() => buffer && result?.data ? readEditorSheet(buffer, "Evidence").rows.filter(r => rowAllowed(user, result.data!, "Evidence", r.values)) : [], [buffer, result, user])
  const open = (values: Record<string, unknown>) => {
    try {
      const type = String(values.ContentType)
      if (!TYPES.includes(type)) throw new Error("Unsupported evidence format.")
      const encoded = Array.from({length:48}, (_, i) => String(values[`Content${i + 1}`] ?? "")).join("")
      const blob = new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], { type })
      const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener,noreferrer"); setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch(e) { setError((e as Error).message) }
  }
  return <section className="space-y-4"><h1 className="text-2xl font-semibold">Supporting evidence</h1>
    <p>Evidence is stored in the workbook with its department, related record ID and notes.</p>
    {canEditSheet(user, "Evidence") && <form className="flex flex-wrap items-end gap-3 rounded border bg-card p-4" onSubmit={async e => {
      e.preventDefault(); setError(""); try {
        if (!file || !TYPES.includes(file.type) || file.size > 1024 * 1024) throw new Error("Choose a PDF, PNG, JPEG or text file up to 1 MB.")
        if (!department) throw new Error("Select the permitted department for this evidence.")
        const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte)
        const encoded = btoa(binary)
        const values = { EvidenceId: crypto.randomUUID(), DepartmentId: department, RecordId: recordId, FileName: file.name, ContentType: file.type, Notes: notes, ...Object.fromEntries(Array.from({length:48}, (_, i) => [`Content${i + 1}`, encoded.slice(i * 30000, (i + 1) * 30000)])) }
        await editRecord("Evidence", null, values, "save"); setNotes(""); setRecordId("")
      } catch(e) { setError((e as Error).message) }
    }}>
      <label>Department<select required className="block rounded border p-2" value={department} onChange={e => setDepartment(e.target.value)}><option value="">Choose department</option>{data?.departments.map(d => <option key={d.departmentId} value={d.departmentId}>{d.name}</option>)}</select></label>
      <label>Related record ID<input required className="block rounded border p-2" value={recordId} onChange={e => setRecordId(e.target.value)} /></label>
      <label>Notes<input className="block rounded border p-2" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <label>File · up to 1 MB<input required type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" className="block" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <Button type="submit" disabled={loading}>Upload evidence</Button>
    </form>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {rows.map(r => <div className="flex flex-wrap items-center gap-4 rounded border bg-card p-4" key={r.row}><span>{String(r.values.FileName)} · {String(r.values.RecordId)}</span><span>{String(r.values.Notes)}</span><Button variant="outline" onClick={() => open(r.values)}>Open evidence</Button>{user.Role === "Administrator" && <Button variant="outline" disabled={loading} onClick={async () => { try { await editRecord("Evidence", r.row, r.values, "delete") } catch(e) { setError((e as Error).message) } }}>Remove</Button>}</div>)}
    {!rows.length && <p className="text-muted-foreground">No evidence in your permitted departments.</p>}
  </section>
}
