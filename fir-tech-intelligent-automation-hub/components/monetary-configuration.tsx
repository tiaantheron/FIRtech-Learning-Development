import { useEffect, useMemo, useState } from "react"
import { Banknote, Pencil } from "lucide-react"
import { useWorkbook } from "@/lib/workbook-context"
import { readEditorSheet, workbookSheetNames } from "@/lib/services/workbook-editor"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

type Amounts = Record<string, string>

/** Financial targets are kept in the workbook, so changing them here is an audited Excel edit. */
export function MonetaryConfiguration() {
  const { buffer, result, user, editRecords, loading } = useWorkbook()
  const [open, setOpen] = useState(false)
  const [amounts, setAmounts] = useState<Amounts>({})
  const [error, setError] = useState("")
  const sheet = useMemo(() => {
    if (!buffer) return ""
    // Avoid relying on a particular workbook layout: detailed workbooks use Overview,
    // while the reference workbook keeps the same settings in Settings.
    const workbookNames = new Set(workbookSheetNames(buffer))
    return workbookNames.has("Overview") ? "Overview" : workbookNames.has("Settings") ? "Settings" : ""
  }, [buffer])
  const view = useMemo(() => buffer && sheet ? readEditorSheet(buffer, sheet) : null, [buffer, sheet])
  const keyColumn = view?.headers.includes("Key") ? "Key" : "Setting"
  const valueColumn = view?.headers.includes("Value") ? "Value" : ""
  const departments = useMemo(() => buffer ? readEditorSheet(buffer, "Departments") : null, [buffer])

  useEffect(() => {
    if (!result?.data) return
    const next: Amounts = {
      companyZAR: String(result.data.overview.find(s => s.key === "CompanyRevenueTargetZAR")?.value ?? ""),
      companyUSD: String(result.data.overview.find(s => s.key === "CompanyRevenueTargetUSD")?.value ?? ""),
    }
    departments?.rows.forEach(row => { next[`department:${row.row}`] = String(row.values.RevenueTargetZAR ?? row.values.RevenueTarget ?? "") })
    setAmounts(next)
  }, [result, departments])

  if (user.Role !== "Administrator" || !view || !valueColumn || !departments) return null

  const settingRow = (key: string) => view.rows.find(row => String(row.values[keyColumn]) === key)
  const setAmount = (key: string, value: string) => setAmounts(current => ({ ...current, [key]: value }))
  const amountKeys = ["companyZAR", "companyUSD", ...departments.rows.map(row => `department:${row.row}`)]
  const valid = amountKeys.every(key => {
    const value = amounts[key] ?? ""
    return value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0
  })

  async function save() {
    if (!valid) { setError("Enter a zero or positive number for every monetary target."); return }
    setError("")
    try {
      const edits: { sheet: string; row: number | null; values: Record<string, string | number | boolean>; action: "save" }[] = []
      for (const [key, settingName] of [["companyZAR", "CompanyRevenueTargetZAR"], ["companyUSD", "CompanyRevenueTargetUSD"]] as const) {
        const row = settingRow(settingName)
        const values = row ? { ...row.values, [valueColumn]: amounts[key] } : { [keyColumn]: settingName, [valueColumn]: amounts[key] }
        edits.push({ sheet, row: row?.row ?? null, values, action: "save" })
      }
      for (const row of departments.rows) {
        const targetColumn = departments.headers.includes("RevenueTargetZAR") ? "RevenueTargetZAR" : "RevenueTarget"
        edits.push({ sheet: "Departments", row: row.row, values: { ...row.values, [targetColumn]: Number(amounts[`department:${row.row}`]) }, action: "save" })
      }
      await editRecords(edits)
      setOpen(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the workbook.") }
  }

  return <Card className="border-[var(--resell)]/30">
    <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
      <div><CardTitle className="flex items-center gap-2"><Banknote className="h-4 w-4 text-[var(--resell)]" /> Monetary targets</CardTitle><p className="mt-1 text-sm text-muted-foreground">Configure company and department revenue targets. Changes are saved to the Excel workbook and audit history.</p></div>
      <Button variant="outline" size="sm" onClick={() => { setOpen(value => !value); setError("") }}><Pencil className="h-4 w-4" />{open ? "Close" : "Configure"}</Button>
    </CardHeader>
    {open && <CardContent>
      <form className="space-y-5" onSubmit={event => { event.preventDefault(); void save() }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput label="Company revenue target (ZAR)" value={amounts.companyZAR ?? ""} onChange={value => setAmount("companyZAR", value)} />
          <MoneyInput label="Company revenue target (USD)" value={amounts.companyUSD ?? ""} onChange={value => setAmount("companyUSD", value)} />
        </div>
        <div><p className="mb-3 text-sm font-medium">Department revenue targets (ZAR)</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{departments.rows.map(row => <MoneyInput key={row.row} label={String(row.values.Name ?? row.values.Department ?? row.values.DepartmentId)} value={amounts[`department:${row.row}`] ?? ""} onChange={value => setAmount(`department:${row.row}`, value)} />)}</div></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? "Updating workbook…" : "Apply targets to Excel"}</Button>
      </form>
    </CardContent>}
  </Card>
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium">{label}<input className="mt-1 block w-full rounded border bg-background p-2 font-normal tabular-nums" type="number" min="0" step="any" value={value} onChange={event => onChange(event.target.value)} /></label>
}
