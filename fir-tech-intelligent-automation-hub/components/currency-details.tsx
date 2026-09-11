import type { CurrencyConversion } from "@/lib/models/types"
import { reportingAmount } from "@/lib/calculations/currency"
import { formatCurrency } from "@/lib/utils/format"
export function CurrencyDetails({ record, amount }: { record: CurrencyConversion & { currency: string }; amount: number }) {
  const currency = record.reportingCurrency || "ZAR"
  const value = reportingAmount(amount, record, currency)
  return <div className="min-w-40 text-sm"><p>{value === null ? "Not converted" : formatCurrency(value, currency)}</p>{!!record.exchangeRate && <p className="text-muted-foreground">Rate {record.exchangeRate} · {record.exchangeRateDate}<br />{record.exchangeRateSource}</p>}</div>
}

