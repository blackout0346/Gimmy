import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const neutral = "bg-muted text-text-secondary"
const brand = "bg-primary-50 text-primary-800"
const error = "bg-error-bg text-destructive"

const badgeVariants = cva(
  [
    "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1",
    "rounded-[6px] px-2 py-1 text-[12px]/[16px] font-medium whitespace-nowrap",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "[&>svg]:pointer-events-none [&>svg]:size-3! [&>svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        neutral,
        brand,
        success:"bg-success-bg text-success",
        warning:"bg-warning-bg text-warning",
        error,
        default: brand,
        secondary:
          neutral,
        destructive:
          error,
        outline:
          "border border-border text-foreground",
        ghost:
          "text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
