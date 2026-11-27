"use client"

import { useRef, useState, type FormEvent } from "react"
import type { ConditionResponse } from "@/dtos/product/product.dto"
import { filterDraft, validateFilterDraft, type CatalogFilters as Filters, type FilterDraft, type FilterErrors } from "@/lib/catalog-filters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

type CatalogFiltersProps = {
  value: Filters
  conditions: readonly ConditionResponse[]
  conditionsLoading: boolean
  conditionsError: boolean
  onRetryConditions: () => void
  onApply: (value: Omit<Filters, "sortBy" | "page">) => void
  onReset: () => void
}

// Catalog fields use the shared controls; this component owns only filter form logic.
export function CatalogFilters({ value, conditions, conditionsLoading, conditionsError, onRetryConditions, onApply, onReset }: CatalogFiltersProps) {
  const [draft, setDraft] = useState<FilterDraft>(() => filterDraft(value))
  const [errors, setErrors] = useState<FilterErrors>({})
  const formRef = useRef<HTMLFormElement>(null)

  function change(name: keyof FilterDraft, next: string) {
    setDraft((current) => ({ ...current, [name]: next }))
    setErrors((current) => name === "minPrice" || name === "maxPrice"
      ? { ...current, minPrice: undefined, maxPrice: undefined }
      : { ...current, [name]: undefined })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateFilterDraft(draft)
    setErrors(result.errors)
    const first = Object.keys(result.errors)[0]
    if (first) { formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return }
    onApply(result.filters)
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} aria-label="Фильтры объявлений" className="space-y-5 rounded-[12px] border border-border bg-card p-4 md:p-5">
      <h3 className="text-lg/6 font-semibold">Фильтры</h3>
      <fieldset>
        <legend className="mb-2 text-sm/5 font-medium">Цена, ₽</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["minPrice", "maxPrice"] as const).map((name) => (
            <Field key={name}>
              <FieldLabel htmlFor={`catalog-${name}`} className="sr-only">{name === "minPrice" ? "Минимальная цена" : "Максимальная цена"}</FieldLabel>
              <Input id={`catalog-${name}`} name={name} inputMode="decimal" placeholder={name === "minPrice" ? "От" : "До"} value={draft[name]} onChange={(event) => change(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `catalog-${name}-error` : undefined} />
              {errors[name] && <FieldError id={`catalog-${name}-error`}>{errors[name]}</FieldError>}
            </Field>
          ))}
        </div>
      </fieldset>
      <Field>
        <FieldLabel htmlFor="catalog-condition">Состояние</FieldLabel>
        <Select id="catalog-condition" name="conditionId" value={draft.conditionId} onChange={(event) => change("conditionId", event.target.value)} disabled={conditionsLoading}>
          <option value="">Любое состояние</option>
          {draft.conditionId && !conditions.some((condition) => condition.id === draft.conditionId) && <option value={draft.conditionId}>Выбранное состояние</option>}
          {conditions.map((condition) => <option key={condition.id} value={condition.id}>{condition.name}</option>)}
        </Select>
        {conditionsLoading && <p role="status" className="text-xs text-muted-foreground">Загружаем состояния…</p>}
        {conditionsError && <div role="alert" className="text-xs/5 text-muted-foreground">Не удалось загрузить состояния. <Button type="button" variant="text" size="sm" onClick={onRetryConditions}>Повторить</Button></div>}
      </Field>
      <Field>
        <FieldLabel htmlFor="catalog-position">Город</FieldLabel>
        <Input id="catalog-position" name="position" value={draft.position} placeholder="Например, Москва" autoComplete="address-level2" onChange={(event) => change("position", event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="catalog-rating">Оценка от</FieldLabel>
        <Input id="catalog-rating" name="minRating" inputMode="decimal" value={draft.minRating} placeholder="От 0 до 5" onChange={(event) => change("minRating", event.target.value)} aria-invalid={Boolean(errors.minRating)} aria-describedby={errors.minRating ? "catalog-rating-error" : undefined} />
        {errors.minRating && <FieldError id="catalog-rating-error">{errors.minRating}</FieldError>}
      </Field>
      <div className="grid gap-2">
        <Button type="submit">Применить</Button>
        <Button type="button" variant="secondary" onClick={() => { setDraft(filterDraft({ sortBy: value.sortBy, page: 1 })); setErrors({}); onReset() }}>Сбросить параметры</Button>
      </div>
    </form>
  )
}
