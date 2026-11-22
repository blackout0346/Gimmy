import { cva } from "class-variance-authority"

const controlFrame =
  "w-full min-w-0 rounded-[10px] border border-input bg-card text-foreground outline-none transition-colors placeholder:text-muted-foreground enabled:hover:border-border-strong enabled:focus:border-ring enabled:focus:shadow-[inset_0_0_0_1px_var(--ring)] aria-invalid:border-destructive aria-invalid:enabled:hover:border-destructive aria-invalid:enabled:focus:border-destructive aria-invalid:enabled:focus:shadow-[inset_0_0_0_1px_var(--destructive)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"

const controlVariants = cva(controlFrame, {
  variants: {
    controlSize: {
      sm: "h-10 px-3 text-sm/5",
      default: "h-12 px-4 text-base/6",
      lg: "h-14 px-4 text-base/6",
      search: "h-[52px] px-4 text-base/6",
    },
  },
  defaultVariants: { controlSize: "default" },
})

export { controlFrame, controlVariants }
