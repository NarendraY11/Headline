
export function TodayLoader() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
      <div className="relative z-10 px-4 py-8 md:py-16 max-w-7xl mx-auto space-y-12 animate-pulse">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3 max-w-md">
            <div className="h-4 bg-muted-2/25 w-24 rounded font-mono"></div>
            <div className="h-10 bg-ink/10 w-64 rounded-lg"></div>
            <div className="h-4 bg-muted/20 w-80 rounded"></div>
          </div>
          <div className="h-10 bg-muted/15 w-40 rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-paper border border-rule/50 rounded-2xl p-5 h-28 flex flex-col justify-between">
              <div className="h-4 bg-muted-2/20 w-16 rounded font-mono"></div>
              <div className="h-8 bg-ink/10 w-20 rounded"></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-paper border border-rule/50 rounded-2xl p-6 h-96 space-y-6">
            <div className="flex justify-between items-center border-b border-rule/35 pb-4">
              <div className="h-5 bg-ink/10 w-32 rounded"></div>
              <div className="h-4 bg-muted-2/20 w-16 rounded"></div>
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-muted/20 w-full rounded"></div>
              <div className="h-4 bg-muted/20 w-5/6 rounded"></div>
              <div className="h-4 bg-muted/20 w-4/5 rounded"></div>
            </div>
          </div>
          <div className="bg-paper border border-rule/50 rounded-2xl p-6 h-96 space-y-6">
            <div className="h-5 bg-ink/10 w-2/3 rounded border-b border-rule/35 pb-4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-muted/10 w-full rounded-lg"></div>
              <div className="h-10 bg-muted/10 w-full rounded-lg"></div>
              <div className="h-10 bg-muted/10 w-full rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
