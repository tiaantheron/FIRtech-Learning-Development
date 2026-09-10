import type { Currency } from "@/lib/models/types"

export function formatCurrency(value: number, currency: Currency = "ZAR"): string {
  const locale = currency === "USD" ? "en-US" : "en-ZA"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(value || 0)
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${((value || 0) * 100).toFixed(fractionDigits)}%`
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function clampPct(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
