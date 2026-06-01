export const getPacingData = (savedDate: string, logbook: any[]) => {
  const today = new Date();
  const targetDate = savedDate ? new Date(savedDate) : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  let cumulativeHours = 0;
  const historyData: { day: string; actual: number; target: number }[] = [];
  
  const totalTargetHours = 50;
  const daysToTarget = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    if (logbook.length > 0) {
      cumulativeHours = logbook
        .filter(l => l.dateISO && new Date(l.dateISO).getTime() <= d.getTime() + 24 * 3600 * 1000)
        .reduce((sum, l) => sum + ((l.durationSec || 0) / 3600), 0);
    } else {
      cumulativeHours = 0;
    }
    
    const baselineStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    const totalPeriod = (targetDate.getTime() - baselineStart.getTime()) || 1;
    const progressRatio = (d.getTime() - baselineStart.getTime()) / totalPeriod;
    const targetHours = Math.max(0, Math.round(totalTargetHours * Math.min(1, progressRatio) * 10) / 10);

    historyData.push({
      day: dateStr,
      actual: Math.round(cumulativeHours * 10) / 10,
      target: targetHours,
    });
  }

  const projDate = new Date(today);
  projDate.setDate(today.getDate() + Math.min(daysToTarget, 5));
  const projDateStr = projDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " (Proj)";
  
  const baselineStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const totalPeriod = (targetDate.getTime() - baselineStart.getTime()) || 1;
  const progressRatio = (projDate.getTime() - baselineStart.getTime()) / totalPeriod;
  const projTargetHours = Math.max(0, Math.round(totalTargetHours * Math.min(1, progressRatio) * 10) / 10);

  historyData.push({
    day: projDateStr,
    actual: Math.round(cumulativeHours * 10) / 10,
    target: projTargetHours
  });

  return historyData;
};
