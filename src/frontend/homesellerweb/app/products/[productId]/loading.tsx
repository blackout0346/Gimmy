export default function Loading() {
  return (
    <main
      role="status"
      className="mx-auto w-full max-w-[1328px] px-4 py-6 md:px-6"
    >
      <span className="sr-only">Загружаем объявление</span>

      <div aria-hidden="true" className="space-y-4">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="aspect-[4/3] rounded-[12px] bg-muted" />
          <div className="h-72 rounded-[12px] bg-muted" />
        </div>
      </div>
    </main>
  )
}