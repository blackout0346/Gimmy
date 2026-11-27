import Link from "next/link"
import { Footer } from "@/components/ui/footer"
import { routes } from "@/lib/routes"

const links = [
  { href: routes.home, label: "Все объявления" },
  { href: routes.create, label: "Подать объявление" },
]

export function SiteFooter() {
  return (
    <Footer className="px-0 py-6 text-muted-foreground md:py-8">
      <div className="mx-auto w-full max-w-[1328px] px-4 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <Link
              href={routes.home}
              aria-label="Gimmy — на главную"
              className="inline-flex min-h-11 items-center rounded-[6px] text-xl/7 font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Gimmy<span className="text-primary">.</span>
            </Link>
            <p className="max-w-sm text-sm/5">
              Площадка для ваших объявлений.
            </p>
          </div>
          <nav aria-label="Навигация в подвале" className="flex flex-wrap gap-x-6 gap-y-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="inline-flex min-h-11 items-center rounded-[6px] text-sm/5 font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-4 text-xs/5">© 2026 Gimmy</p>
      </div>
    </Footer>
  )
}
