import type { ReactNode } from "react"

type EmptyStateProps = {
  title: string
  description?: string
  children?: ReactNode
  role?: "status" | "alert"
}

function EmptyState({ title, description, children, role = "status" }: EmptyStateProps) {
  return (
    <div role={role} className="rounded-[12px] border border-border bg-card px-6 py-10 text-center">
      <h3 className="text-lg/6 font-semibold">{title}</h3>
      {description && <p className="mt-2 text-sm/5 text-muted-foreground">{description}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

export { EmptyState }
