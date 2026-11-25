"use client"

import { cn } from "cn"

type CategoryNavigationProps = {
    categories: readonly string[]
    value: string
    onValueChange: (category: string) => void
}

export function CategoryNavigation({ categories, value, onValueChange }: CategoryNavigationProps){
    return(
        <nav aria-label="Категории объявлений" className="mx-auto w-full max-w-[1328px] px-4 md:px-6">
            <ul className="flex h-11 items-stretch gap-6 overflow-x-auto">
                {["", ...categories].map((category)=> (
                    <li key={category} className="flex shrink-0">
                        <button
                          type="button"
                          aria-pressed={value === category}
                          onClick={() => onValueChange(category)}
                          className={cn(
                            "inline-flex h-full cursor-pointer items-center border-b-2 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                            value === category
                               ? "border-primary font-semibold text-primary"
                               : "border-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                            {category || "Все категории"}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )
}