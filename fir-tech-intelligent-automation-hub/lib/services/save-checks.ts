import type { ParseResult } from "@/lib/models/types"
export function assertWorkbookSaveable(result: ParseResult) {
  if (!result.data || result.issues.some(i => i.severity === "error")) throw new Error("Resolve workbook validation errors before saving.")
  const active = result.data.departments.filter(d => !["archived", "inactive"].includes((d.status ?? "Active").toLowerCase()))
  const total = active.reduce((sum, d) => sum + d.revenueAllocationPct, 0)
  if (active.length && Math.abs(total - 1) > 0.000001) throw new Error(`Active department revenue allocations total ${(total * 100).toFixed(2)}%. Adjust allocations to 100% before saving Excel.`)
}
export function assertUnchangedFile(current: ArrayBuffer, expected: ArrayBuffer) {
  const a = new Uint8Array(current), b = new Uint8Array(expected)
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) throw new Error("The destination workbook differs from the version loaded or last saved. No overwrite was performed. Reload the newer file or save under a new filename.")
}
