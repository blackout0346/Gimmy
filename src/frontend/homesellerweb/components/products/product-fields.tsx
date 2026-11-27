"use client"

import type { ReactNode } from "react"
import type { ConditionResponse, TagResponse } from "@/dtos/product/product.dto"
import type { PublicationValues } from "@/lib/drafts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Radio } from "@/components/ui/selection-controls"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

export type ProductFieldErrors = Partial<Record<keyof PublicationValues, string>>
type ProductFieldsProps = {
  values: PublicationValues
  updateField: (name: keyof PublicationValues, value: string) => void
  tags: TagResponse[]
  conditions: ConditionResponse[]
  lookupLoading: boolean
  lookupError: boolean
  onLookupRetry: () => void
  fieldErrors: ProductFieldErrors
  photoPicker: ReactNode
  categoryControl?: ReactNode
}

export function ProductFields({ values, updateField, tags, conditions, lookupLoading, lookupError, onLookupRetry, fieldErrors, photoPicker, categoryControl }: ProductFieldsProps) {
  return <>
                <section className="space-y-6 rounded-[12px] border border-border bg-card p-4 md:p-6">
                  <h2 className="text-lg/6 font-semibold">Основное</h2>
                  <Field data-invalid={Boolean(fieldErrors.nameProduct)}>
                    <FieldLabel htmlFor="product-name">Название</FieldLabel>
                    <Input id="product-name" name="nameProduct" data-field="nameProduct" required value={values.nameProduct} onChange={(event) => updateField("nameProduct", event.target.value)} aria-invalid={Boolean(fieldErrors.nameProduct)} aria-describedby={fieldErrors.nameProduct ? "name-error" : undefined} />
                    {fieldErrors.nameProduct && <FieldError id="name-error">{fieldErrors.nameProduct}</FieldError>}
                  </Field>
                  {lookupLoading && <p role="status" className="text-sm text-muted-foreground">Загружаем категории и состояния…</p>}
                  {lookupError && <div role="alert" className="text-sm text-destructive">Не удалось загрузить справочники. <Button type="button" variant="text" size="sm" onClick={() => onLookupRetry()}>Повторить</Button></div>}
                  {!lookupLoading && !lookupError && (!tags.length || !conditions.length) && <p role="status" className="text-sm text-muted-foreground">Справочники категорий или состояний пока пусты.</p>}
                  <div className="grid items-start gap-6 sm:grid-cols-2">
                    {categoryControl ?? (
                    <Field data-invalid={Boolean(fieldErrors.tagId)}>
                      <FieldLabel htmlFor="product-category">Категория</FieldLabel>
                      <Select id="product-category" name="tagId" data-field="tagId" required value={values.tagId} disabled={lookupLoading || !tags.length} onChange={(event) => updateField("tagId", event.target.value)} aria-invalid={Boolean(fieldErrors.tagId)} aria-describedby={fieldErrors.tagId ? "category-error" : undefined}>
                        <option value="" disabled>Выберите категорию</option>
                        {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                      </Select>
                      {fieldErrors.tagId && <FieldError id="category-error">{fieldErrors.tagId}</FieldError>}
                    </Field>
                    )}
                    <Field data-invalid={Boolean(fieldErrors.price)}>
                      <FieldLabel htmlFor="product-price">Цена, ₽</FieldLabel>
                      <Input id="product-price" name="price" data-field="price" inputMode="decimal" placeholder="Например, 24 000" value={values.price} onChange={(event) => updateField("price", event.target.value)} aria-invalid={Boolean(fieldErrors.price)} aria-describedby={fieldErrors.price ? "price-error" : "price-hint"} />
                      {fieldErrors.price ? <FieldError id="price-error">{fieldErrors.price}</FieldError> : <FieldDescription id="price-hint">Оставьте пустым, если цена договорная.</FieldDescription>}
                    </Field>
                  </div>
                  <fieldset disabled={lookupLoading || !conditions.length} aria-describedby={fieldErrors.conditionId ? "condition-error" : undefined}>
                    <legend className="mb-2 text-sm/5 font-medium">Состояние</legend>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      {conditions.map((condition) => (
                        <Radio key={condition.id} name="conditionId" data-field="conditionId" value={condition.id} required checked={values.conditionId === condition.id} onChange={() => updateField("conditionId", condition.id)} aria-invalid={Boolean(fieldErrors.conditionId)}>
                          {condition.name}
                        </Radio>
                      ))}
                    </div>
                    {fieldErrors.conditionId && <FieldError id="condition-error">{fieldErrors.conditionId}</FieldError>}
                  </fieldset>
                  <Field>
                    <FieldLabel htmlFor="product-description">Описание</FieldLabel>
                    <Textarea id="product-description" name="description" data-field="description" value={values.description} onChange={(event) => updateField("description", event.target.value)} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "description-error" : undefined} />
                    {fieldErrors.description && <FieldError id="description-error">{fieldErrors.description}</FieldError>}
                  </Field>
                </section>
                <section className="space-y-4 rounded-[12px] border border-border bg-card p-4 md:p-6">
                  <h2 className="text-lg/6 font-semibold">Фотографии</h2>
                  {photoPicker}
                </section>
                <section className="rounded-[12px] border border-border bg-card p-4 md:p-6">
                  <Field data-invalid={Boolean(fieldErrors.position)}>
                    <FieldLabel htmlFor="product-position">Город или населённый пункт</FieldLabel>
                    <Input id="product-position" name="position" data-field="position" required value={values.position} onChange={(event) => updateField("position", event.target.value)} aria-invalid={Boolean(fieldErrors.position)} aria-describedby={fieldErrors.position ? "position-error" : undefined} />
                    {fieldErrors.position && <FieldError id="position-error">{fieldErrors.position}</FieldError>}
                  </Field>
                </section>
  </>
}
