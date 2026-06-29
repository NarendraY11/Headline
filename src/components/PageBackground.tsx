interface PageBackgroundProps {
  blueprintOpacity?: number;
}

export function PageBackground({ blueprintOpacity = 40 }: PageBackgroundProps) {
  return (
    <>
      <div
        className="absolute inset-0 blueprint pointer-events-none z-0"
        style={{ opacity: blueprintOpacity / 100 }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 paper-grain pointer-events-none z-1" aria-hidden="true" />
    </>
  );
}
