"use client"

import type { FormEventHandler } from "react"
import { Search } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SearchFormProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  className?: string
}

export function SearchForm({ value, onValueChange, onSubmit, className }: SearchFormProps) {
  return (
    <form role="search" onSubmit={onSubmit} className={cn("flex min-w-0 items-center gap-2", className)}>
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-3.5 hidden size-5 text-muted-foreground md:block" />
        <Input
          type="search"
          name="search"
          controlSize="default"
          aria-label="Поиск объявлений"
          placeholder="Что вы ищете?"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="pr-14 md:pr-4 md:pl-11"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Найти объявления"
          className="absolute top-0.5 right-0.5 md:hidden"
        >
          <Search aria-hidden="true" />
        </Button>
      </div>
      <Button type="submit" size="lg" className="max-md:hidden px-4 min-[1200px]:px-6">Найти</Button>
    </form>
  )
}
