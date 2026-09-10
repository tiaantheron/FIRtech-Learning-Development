import type { CurrencyConversion } from "@/lib/models/types"
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
