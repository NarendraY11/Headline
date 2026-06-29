

export function LoadingFallback() {
  return (
    <div role="status" aria-label="Loading content" className="w-full max-w-[1200px] mx-auto px-6 py-8 md:py-12 animate-pulse">
      {/* Header Eyebrow Skeleton */}
      <div className="h-3 w-24 bg-rule/50 rounded-full mb-3" />
      
      {/* Header Display Title Skeleton */}
      <div className="h-8 md:h-12 w-1/3 min-w-[200px] max-w-[360px] bg-rule-strong/40 rounded-lg mb-8" />
      
      {/* Grid Content Cabin Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="border border-rule rounded-2xl p-6 flex flex-col gap-4">
          <div className="h-4 w-12 bg-rule-strong/40 rounded-full" />
          <div className="h-6 w-3/4 bg-rule/50 rounded-lg" />
          <div className="h-3 w-1/2 bg-rule/30 rounded-full mt-2" />
          <div className="space-y-2 mt-4">
            <div className="h-2 w-full bg-rule/20 rounded-full" />
            <div className="h-2 w-5/6 bg-rule/20 rounded-full" />
            <div className="h-2 w-4/5 bg-rule/20 rounded-full" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="border border-rule rounded-2xl p-6 flex flex-col gap-4">
          <div className="h-4 w-16 bg-rule-strong/40 rounded-full" />
          <div className="h-6 w-2/3 bg-rule/50 rounded-lg" />
          <div className="h-3 w-2/5 bg-rule/30 rounded-full mt-2" />
          <div className="space-y-2 mt-4">
            <div className="h-2 w-full bg-rule/20 rounded-full" />
            <div className="h-2 w-11/12 bg-rule/20 rounded-full" />
            <div className="h-2 w-3/4 bg-rule/20 rounded-full" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="border border-rule rounded-2xl p-6 flex flex-col gap-4">
          <div className="h-4 w-14 bg-rule-strong/40 rounded-full" />
          <div className="h-6 w-5/6 bg-rule/50 rounded-lg" />
          <div className="h-3 w-1/3 bg-rule/30 rounded-full mt-2" />
          <div className="space-y-2 mt-4">
            <div className="h-2 w-full bg-rule/20 rounded-full" />
            <div className="h-2 w-4/5 bg-rule/20 rounded-full" />
            <div className="h-2 w-5/6 bg-rule/20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Decorative Table/List Skeleton below */}
      <div className="mt-12 border border-rule/70 rounded-2xl p-6 space-y-4">
        <div className="h-4 w-40 bg-rule-strong/40 rounded-full mb-3" />
        <div className="flex items-center justify-between py-2 border-b border-rule/30">
          <div className="h-3 w-1/4 bg-rule/40 rounded-full" />
          <div className="h-3 w-16 bg-rule/30 rounded-full" />
        </div>
        <div className="flex items-center justify-between py-2 border-b border-rule/30">
          <div className="h-3 w-1/3 bg-rule/40 rounded-full" />
          <div className="h-3 w-12 bg-rule/30 rounded-full" />
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="h-3 w-1/5 bg-rule/40 rounded-full" />
          <div className="h-3 w-20 bg-rule/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}
