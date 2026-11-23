import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"
import { cn } from "cn"

const primary = "bg-primary text-primary-foreground hover:bg-primary-800 active:bg-primary-900"

const secondary = "border-border-strong bg-card text-card-foreground hover:bg-muted active:bg-neutral-pressed"

const danger = "bg-destructive text-white hover:bg-destructive-hover active:bg-destructive-pressed"

const text = "text-primary hover:text-primary-800 active:text-primary-900"

const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center rounded-[10px]",
    "border border-transparent font-semibold whitespace-nowrap select-none transition-colors motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
    "aria-invalid:border-destructive",
    "disabled:pointer-events-none disabled:border-transparent disabled:bg-neutral-pressed disabled:text-muted-foreground",
    "data-disabled:pointer-events-none data-disabled:border-transparent data-disabled:bg-neutral-pressed data-disabled:text-muted-foreground",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0"
  ],
  {
    variants: {
      variant: {
        default: primary,
        primary,
        outline: secondary,
        secondary,
        soft: "bg-primary-50 text-primary-800 hover:bg-primary-100 active:bg-primary-200",
        ghost: "text-foreground hover:bg-muted active:bg-neutral-pressed",
        destructive: danger,
        danger,
        link: text,
        text,
      },
      size: {
        default:
          "h-11 gap-2 px-5 text-[14px]/[20px] [&_svg:not([class*='size-'])]:size-[18px]",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 text-[13px]/[18px] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-6 text-[16px]/[24px] [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11 [&_svg:not([class*='size-'])]:size-5",
        "icon-xs":
          "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  "aria-busy": ariaBusy,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & {loading?: boolean}) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || ariaBusy}
    >
      {loading ? (
        <>
          <span className="inline-flex items-center gap-[inherit] opacity-0">
            {children}
          </span>
          <LoaderCircle aria-hidden="true" className="absolute animate-spin motion-reduce:animate-none"/>
        </>
      ) : (children)}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
