import type { ComponentProps } from "react"
import type { VariantProps } from "class-variance-authority"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

import { controlVariants } from "@/components/ui/control-styles"

type SelectProps = ComponentProps<"select"> & { controlSize?: Exclude<VariantProps<typeof controlVariants>["controlSize"], "search"> }

function Select({ className, controlSize, ...props }: SelectProps) {
  return (
    <div className="relative w-full min-w-0">
      <select
        data-slot="select"
        className={cn(controlVariants({ controlSize }), "appearance-none pr-10", className)}
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { Select }
