"use client"

import { useState } from "react"
import type { TagResponse } from "@/dtos/product/product.dto"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/selection-controls"

type ProductCategorySelectorProps = {
  tags: TagResponse[]
  selectedIds: string[]
  disabled: boolean
  invalid: boolean
  onChange: (ids: string[]) => void
}

export function ProductCategorySelector({ tags, selectedIds, disabled, invalid, onChange }: ProductCategorySelectorProps) {
  const [query, setQuery] = useState("")
  const search = query.trim().toLocaleLowerCase("ru")
  const visible = tags.filter((tag) => tag.name.toLocaleLowerCase("ru").includes(search))

  return (
    <div className="min-w-0 space-y-3">
      <Input
        type="search"
        aria-label="Поиск категории"
        placeholder="Найти категорию"
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault() }}
      />
      <p className="text-xs/5 text-muted-foreground">Можно выбрать несколько · Выбрано: {selectedIds.length}</p>
      <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto overscroll-contain rounded-[10px] border border-border p-1 [scrollbar-gutter:stable]">
        {visible.map((tag) => {
          const selected = selectedIds.includes(tag.id)
          return (
            <li key={tag.id} className={`min-w-0 rounded-[6px] [&>label]:flex [&>label]:w-full [&>label]:cursor-pointer [&>label]:px-2 ${selected ? "bg-primary-50" : "hover:bg-background"}`}>
              <Checkbox
                data-field="tagId"
                value={tag.id}
                checked={selected}
                disabled={disabled}
                aria-invalid={invalid}
                onChange={(event) => {
                  if (disabled) return
                  onChange(event.target.checked ? [...selectedIds, tag.id] : selectedIds.filter((id) => id !== tag.id))
                }}
              >
                <span className={`min-w-0 whitespace-normal break-words py-2 text-sm/5 ${selected ? "text-primary" : ""}`}>{tag.name}</span>
              </Checkbox>
            </li>
          )
        })}
      </ul>
      {!visible.length && <p role="status" className="text-sm/5 text-muted-foreground">Категории не найдены. Измените запрос.</p>}
    </div>
  )
}
