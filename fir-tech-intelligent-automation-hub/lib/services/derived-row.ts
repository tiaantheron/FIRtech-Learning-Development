import type { CellValue } from "./workbook-editor"
export const DERIVED_COLUMNS = ["ConvertedAmount", "WeightedValue", "Remaining"]

/** Shared by the form preview and the Excel writer. */
export function deriveRow(values: Record<string, CellValue>, headers: string[]) {
  const next = { ...values }
  if (headers.includes("ConvertedAmount")) {
    const amount = Number(next.Amount ?? next.EstimatedValue ?? next.ContractValue ?? 0)
    next.ConvertedAmount = next.ExchangeRate === "" || next.ExchangeRate === undefined ? "" : Math.round(amount * Number(next.ExchangeRate) * 100) / 100
  }
  if (headers.includes("Remaining")) next.Remaining = Math.max(Number(next.Required) - Number(next.Attained), 0)
  if (headers.includes("WeightedValue")) {
    const stage = String(next.Stage).toLowerCase()
    const raw = String(next.Probability)
    const probability = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw) > 1 ? Number(raw) / 100 : Number(raw)
    next.WeightedValue = Math.round(Number(next.EstimatedValue) * (stage === "closed won" ? 1 : stage === "closed lost" ? 0 : probability) * 100) / 100
  }
  return next
}
