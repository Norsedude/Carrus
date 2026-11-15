export default function SearchLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6" aria-busy="true">
      <p role="status" className="text-sm font-medium text-gray-700">Searching for available vehicles…</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="h-96 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </main>
  );
}
