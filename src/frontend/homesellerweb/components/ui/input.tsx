import type { ComponentProps } from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { controlVariants } from "@/components/ui/control-styles"

type InputProps = ComponentProps<"input"> & VariantProps<typeof controlVariants>

function Input({ className, controlSize, type, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        controlVariants({ controlSize: controlSize ?? (type === "search" ? "search" : undefined) }),
        "file:mr-2 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function InputInline({
  className,
  placeholder = "Поиск объявлений",
  "aria-label": ariaLabel = "Поиск объявлений",
  ...props
}: ComponentProps<"input">) {
  return (
    <Field orientation="horizontal">
      <Input
        {...props}
        type="search"
        controlSize="default"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn("flex-1", className)}
      />
      <Button size="lg" type="submit">Найти</Button>
    </Field>
  )
}

export { Input, InputInline }
