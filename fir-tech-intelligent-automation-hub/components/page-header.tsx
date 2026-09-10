export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function SectionHeading({
  title,
  tone = "default",
  right,
}: {
  title: string
  tone?: "default" | "resell" | "services"
  right?: React.ReactNode
}) {
  const bar = {
    default: "bg-primary",
    resell: "bg-[var(--resell)]",
    services: "bg-[var(--services)]",
  }[tone]
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
        <span className={`inline-block h-4 w-1 rounded-full ${bar}`} aria-hidden />
        {title}
      </h2>
      {right}
    </div>
  )
}
