"use client"

import { cn } from "cn"

const featuredCategoryNames = [
  "Электроника",
  "Транспорт",
  "Для дома и дачи",
  "Личные вещи",
]

type CategoryNavigationProps = {
  categories: readonly string[]
  value: string
  onValueChange: (category: string) => void
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}

export function CategoryNavigation({
  categories,
  value,
  onValueChange,
  loading = false,
  error = false,
  onRetry,
}: CategoryNavigationProps) {
  const featured = featuredCategoryNames.filter((category) =>
    categories.includes(category)
  )

  const otherCategories = categories.filter(
    (category) => !featured.includes(category)
  )

  const otherSelected = otherCategories.includes(value)

  return (
    <nav
      aria-label="Категории объявлений"
      aria-busy={loading}
      className="mx-auto w-full max-w-[1328px] px-4 md:px-6"
    >
      <ul className="flex h-11 items-stretch gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {["", ...featured].map((category) => (
          <li key={category} className="flex shrink-0">
            <button
              type="button"
              aria-pressed={value === category}
              onClick={() => onValueChange(category)}
              className={cn(
                "inline-flex h-full cursor-pointer items-center border-b-2 text-sm whitespace-nowrap",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                value === category
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {category || "Все категории"}
            </button>
          </li>
        ))}

        {otherCategories.length > 0 && (
          <li className="flex shrink-0">
            <select
              aria-label="Другие категории"
              value={otherSelected ? value : ""}
              onChange={(event) => onValueChange(event.target.value)}
              className={cn(
                "h-full max-w-[240px] cursor-pointer border-b-2 bg-card pr-2 text-sm",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                otherSelected
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <option value="" disabled>
                Ещё категории
              </option>

              {otherCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </li>
        )}

        {loading && (
          <li
            role="status"
            className="flex shrink-0 items-center text-sm text-muted-foreground"
          >
            Загрузка категорий…
          </li>
        )}

        {error && (
          <li className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <span role="alert">Категории недоступны.</span>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="h-full cursor-pointer text-primary hover:text-primary-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                Повторить
              </button>
            )}
          </li>
        )}
      </ul>
    </nav>
  )
}