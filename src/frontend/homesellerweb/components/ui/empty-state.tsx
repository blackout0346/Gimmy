import type { ReactNode } from "react"
import { CircleAlert, Inbox } from "lucide-react"

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  role?: "status" | "alert"
}

function EmptyState({ icon, title, description, children, role = "status" }: EmptyStateProps) {
  return (
    <div role={role} className="rounded-[12px] border border-border bg-card px-6 py-10 text-center">
      <div aria-hidden="true" className={`mx-auto mb-4 grid size-14 place-items-center rounded-full [&_svg]:size-6 ${role === "alert" ? "bg-muted text-muted-foreground" : "bg-primary-50 text-primary"}`}>{icon ?? (role === "alert" ? <CircleAlert /> : <Inbox />)}</div>
      <h3 className="text-lg/6 font-semibold">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm/6 text-muted-foreground">{description}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

export { EmptyState }
