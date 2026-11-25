import { Footer } from "@/components/ui/footer"

export function SiteFooter() {
  return (
    <Footer className="px-0">
      <div className="mx-auto flex w-full max-w-[1328px] flex-wrap items-center justify-between gap-2 px-4 md:px-6">
        <span className="font-semibold text-foreground">Gimmy<span className="text-primary">.</span></span>
        <span>2026</span>
      </div>
    </Footer>
  )
}
