import type { ComponentProps } from "react"
import { X } from "lucide-react"
import { cn } from "cn"

type TagProps = ComponentProps<"button"> & {
  selected?: boolean
  removeLabel?: string
}

function Tag({ className, children, selected, removeLabel, type = "button", ...props }: TagProps) {
  return (
    <button
      type={type}
      aria-pressed={removeLabel ? undefined : selected}
      aria-label={removeLabel}
      {...props}
      data-slot="tag"
      className={cn(
        "inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px]/[18px] font-medium whitespace-nowrap",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:border-border disabled:bg-muted disabled:text-muted-foreground",
        selected
          ? "border-primary-200 bg-primary-50 text-primary-800 enabled:hover:bg-primary-100 enabled:active:bg-primary-200"
          : "border-border bg-card text-foreground enabled:hover:border-border-strong enabled:hover:bg-muted enabled:active:border-border-strong enabled:active:bg-neutral-pressed",
        className
      )}
    >
      {children}
      {removeLabel && (
        <X aria-hidden="true" className={cn("size-3.5", selected ? "text-current" : "text-muted-foreground")} />
      )}
    </button>
  )
}

export { Tag }
