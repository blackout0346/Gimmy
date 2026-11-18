import type { ComponentProps } from "react"
import { cn } from "cn"

const statuses = {
  active: { label: "Активно", color: "text-success" },
  pending: { label: "На модерации", color: "text-warning" },
  sold: { label: "Продано", color: "text-muted-foreground" },
  rejected: { label: "Отклонено", color: "text-destructive" },
}

type StatusProps = ComponentProps<"span"> & { status: keyof typeof statuses }

function Status({ status, className, children, ...props }: StatusProps) {
  const { label, color } = statuses[status]

  return (
    <span
      {...props}
      data-slot="status"
      className={cn("inline-flex min-h-5 items-center gap-2 text-[13px]/[20px] font-medium", color, className)}
    >
      <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-current" />
      {children ?? label}
    </span>
  )
}

export { Status }
