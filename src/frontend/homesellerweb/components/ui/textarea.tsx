import type { ComponentProps } from "react"
import { cn } from "cn"

import { controlFrame } from "@/components/ui/control-styles"

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlFrame, "block min-h-32 resize-y px-4 py-3 text-base/6", className)}
      {...props}
    />
  )
}

export { Textarea }
