export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-white/5" />
      <div className="h-64 animate-pulse rounded-[28px] bg-white/5" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-36 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-36 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
