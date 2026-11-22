import type { ComponentProps } from "react"
import { cn } from "cn"

function FooterTitle({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm/5 font-medium text-foreground", className)} {...props} />
}

function Footer({ className, ...props }: ComponentProps<"footer">) {
  return <footer className={cn("w-full border-t border-border bg-card px-4 py-6 text-sm text-text-secondary", className)} {...props} />
}

export { Footer, FooterTitle }
