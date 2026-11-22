import type { ComponentProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check } from "lucide-react"
import { cn } from "cn"

const selectionVariants = cva(
  "inline-flex min-h-11 items-center font-normal text-foreground has-[:disabled]:text-muted-foreground",
  {
    variants: {
      controlSize: {
        sm: "gap-2 text-[13px]/[18px]",
        default: "gap-2.5 text-sm/5",
        lg: "gap-3 text-base/6",
      },
    },
    defaultVariants: { controlSize: "default" },
  }
)

const markVariants = cva(
  "appearance-none border-2 border-border-strong bg-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring enabled:hover:border-ring aria-invalid:border-destructive",
  {
    variants: {
      controlSize: {
        sm: "size-4",
        default: "size-5",
        lg: "size-6",
      },
    },
    defaultVariants: { controlSize: "default" },
  }
)

const checkboxVariants = cva(
  "peer block rounded-sm checked:border-primary checked:bg-primary checked:enabled:hover:border-primary-800 checked:enabled:hover:bg-primary-800 checked:enabled:active:border-primary-900 checked:enabled:active:bg-primary-900 disabled:border-border disabled:bg-muted disabled:checked:border-border-strong disabled:checked:bg-border-strong",
  {
    variants: { controlSize: { sm: "", default: "", lg: "rounded-[5px]" } },
    defaultVariants: { controlSize: "default" },
  }
)

const iconVariants = cva(
  "pointer-events-none absolute inset-0 m-auto hidden text-white peer-checked:block",
  {
    variants: { controlSize: { sm: "size-3", default: "size-3.5", lg: "size-4" } },
    defaultVariants: { controlSize: "default" },
  }
)

const dotVariants = cva(
  "pointer-events-none absolute inset-0 m-auto hidden rounded-full bg-primary peer-checked:block peer-checked:peer-enabled:peer-hover:bg-primary-800 peer-checked:peer-enabled:peer-active:bg-primary-900 peer-disabled:bg-border-strong",
  {
    variants: { controlSize: { sm: "size-1.5", default: "size-2", lg: "size-2.5" } },
    defaultVariants: { controlSize: "default" },
  }
)

const switchVariants = cva(
  "peer appearance-none rounded-full bg-border-strong outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring enabled:hover:bg-muted-foreground enabled:active:bg-text-secondary checked:bg-primary checked:enabled:hover:bg-primary-800 checked:enabled:active:bg-primary-900 disabled:bg-border disabled:checked:bg-border-strong",
  {
    variants: {
      controlSize: {
        sm: "h-5 w-8",
        default: "h-6 w-10",
        lg: "h-7 w-12",
      },
    },
    defaultVariants: { controlSize: "default" },
  }
)

const thumbVariants = cva(
  "pointer-events-none absolute left-1 top-1 rounded-full bg-white",
  {
    variants: {
      controlSize: {
        sm: "size-3 peer-checked:translate-x-3",
        default: "size-4 peer-checked:translate-x-4",
        lg: "size-5 peer-checked:translate-x-5",
      },
    },
    defaultVariants: { controlSize: "default" },
  }
)

type SelectionProps = Omit<ComponentProps<"input">, "type" | "size"> &
  VariantProps<typeof selectionVariants>

function Checkbox({ children, className, controlSize, ...props }: SelectionProps) {
  return (
    <label className={selectionVariants({ controlSize })}>
      <span className="relative inline-flex shrink-0">
        <input
          {...props}
          type="checkbox"
          data-slot="checkbox"
          className={cn(markVariants({ controlSize }), checkboxVariants({ controlSize }), className)}
        />
        <Check aria-hidden="true" className={iconVariants({ controlSize })} />
      </span>
      {children}
    </label>
  )
}

function Radio({ children, className, controlSize, ...props }: SelectionProps) {
  return (
    <label className={selectionVariants({ controlSize })}>
      <span className="relative inline-flex shrink-0">
        <input
          {...props}
          type="radio"
          data-slot="radio"
          className={cn(
            markVariants({ controlSize }),
            "peer rounded-full checked:border-primary checked:enabled:hover:border-primary-800 checked:enabled:active:border-primary-900 disabled:border-border-strong disabled:bg-muted",
            className
          )}
        />
        <span aria-hidden="true" className={dotVariants({ controlSize })} />
      </span>
      {children}
    </label>
  )
}

function Switch({ children, className, controlSize, ...props }: SelectionProps) {
  return (
    <label className={selectionVariants({ controlSize })}>
      <span className="relative inline-flex shrink-0">
        <input
          {...props}
          type="checkbox"
          role="switch"
          data-slot="switch"
          className={cn(switchVariants({ controlSize }), className)}
        />
        <span aria-hidden="true" className={thumbVariants({ controlSize })} />
      </span>
      {children}
    </label>
  )
}

export { Checkbox, Radio, Switch }
