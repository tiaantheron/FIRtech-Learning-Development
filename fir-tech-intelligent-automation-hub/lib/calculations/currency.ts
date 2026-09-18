import type { CurrencyConversion } from "@/lib/models/types"
import { formatCurrency } from "@/lib/utils/format"

export type CurrencyView = "source" | "ZAR"
export type MonetaryRecord = CurrencyConversion & { currency: string }

/** Converts a displayed value, including weighted values, using the recorded rate. */
export function amountInRand(amount: number, record: MonetaryRecord): number | null {
  if (record.currency === "ZAR") return amount
  if (record.reportingCurrency === "ZAR" && record.exchangeRate && record.exchangeRate > 0 && record.exchangeRateDate && record.exchangeRateSource) {
    return Math.round(amount * record.exchangeRate * 100) / 100
  }
  return null
}

export function displayAmount(amount: number, record: MonetaryRecord, view: CurrencyView): string {
  if (view === "source") return formatCurrency(amount, record.currency || "ZAR")
  const converted = amountInRand(amount, record)
  return converted === null ? "No ZAR rate" : formatCurrency(converted, "ZAR")
}

export function originalCurrencyTotals<T extends MonetaryRecord>(records: T[], amount: (record: T) => number) {
  const totals = new Map<string, number>()
  for (const record of records) {
    const currency = record.currency || "ZAR"
    totals.set(currency, (totals.get(currency) ?? 0) + amount(record))
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => ({ currency, value }))
}

export function reportingAmount(amount: number, record: CurrencyConversion & { currency: string }, currency = "ZAR"): number | null {
  if (record.currency === currency) return amount
  if (record.reportingCurrency === currency && record.exchangeRate && record.exchangeRate > 0 && record.exchangeRateDate && record.exchangeRateSource) {
    return record.convertedAmount ?? Math.round(amount * record.exchangeRate * 100) / 100
  }
  return null
}
export function conversionReport(record: CurrencyConversion & { currency: string }, amount: number) {
  return { "Original Currency": record.currency, "Reporting Currency": record.reportingCurrency || "ZAR", "Converted Amount": reportingAmount(amount, record, record.reportingCurrency || "ZAR") ?? "Not converted", "Exchange Rate": record.exchangeRate ?? "", "Exchange Rate Date": record.exchangeRateDate ?? "", "Exchange Rate Source": record.exchangeRateSource ?? "" }
}
