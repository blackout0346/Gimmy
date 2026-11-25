import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "cn"

type BreadcrumbItem = { label: string; href?: string }

type BreadcrumbsProps = {
  items: readonly BreadcrumbItem[]
  className?: string
}

function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items.length) return null

  return (
    <nav aria-label="Хлебные крошки" className={cn("text-sm/5 text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
            {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />}
            {index === items.length - 1 ? (
              <span aria-current="page" className="text-foreground [overflow-wrap:anywhere]">{item.label}</span>
            ) : item.href ? (
              <Link href={item.href} className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{item.label}</Link>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export { Breadcrumbs, type BreadcrumbItem }
