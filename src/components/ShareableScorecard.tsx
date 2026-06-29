import { Download, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "./Atoms";

interface ShareableScorecardProps {
  score: number;
  totalQuestions: number;
  percentage: number;
  subjectTitle: string;
  passed: boolean;
  defaultUserName?: string;
}

export default function ShareableScorecard({
  score,
  totalQuestions,
  percentage,
  subjectTitle,
  passed,
  defaultUserName = ""
}: ShareableScorecardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pilotName, setPilotName] = useState(defaultUserName);
  const [includeName, setIncludeName] = useState(!!defaultUserName);

  const drawScorecard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high-DPI (2x scale) for high quality downloads
    const width = 600;
    const height = 600;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(2, 2);

    // 1. Solid Dark Background
    ctx.fillStyle = "#101214";
    ctx.fillRect(0, 0, width, height);

    // 2. Blueprint Grids / Instrument Circles
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    // Draw vertical & horizontal grids
    for (let i = 40; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // 3. Draw Instrumental Compass dial
    const cx = 300;
    const cy = 210;
    const radius = 110;

    // Concentric flight rings
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 45, 0, Math.PI * 2);
    ctx.stroke();

    // Compass Ticks
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    for (let i = 0; i < 24; i++) {
      const angle = (i * 15 * Math.PI) / 180;
      const isMajor = i % 6 === 0;
      const tickLength = isMajor ? 12 : 6;
      ctx.lineWidth = isMajor ? 1.5 : 0.75;

      const x1 = cx + (radius - 1) * Math.sin(angle);
      const y1 = cy - (radius - 1) * Math.cos(angle);
      const x2 = cx + (radius - 1 - tickLength) * Math.sin(angle);
      const y2 = cy - (radius - 1 - tickLength) * Math.cos(angle);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Compass Headings (N, E, S, W)
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 11px ui-monospace, SFMono-Regular, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText("N", cx, cy - radius + 18);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillText("E", cx + radius - 18, cy);
    ctx.fillText("S", cx, cy + radius - 18);
    ctx.fillText("W", cx - radius + 18, cy);

    // Dynamic color coding
    const brandColor = passed ? "#10B981" : "#EF4444";

    // Draw Score ring on compass
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = brandColor;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    // Offset by -90 degrees to start from top
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (percentage / 100) * Math.PI * 2;
    ctx.arc(cx, cy, radius + 20, startAngle, endAngle);
    ctx.stroke();

    // 4. Centered Score Number inside Dial
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold italic 50px ui-serif, Georgia, Cambria, Times New Roman, Times, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${percentage}%`, cx, cy - 8);

    // Pass Fail pill
    ctx.fillStyle = brandColor;
    ctx.font = "bold 9px ui-monospace, SFMono-Regular, monospace";
    ctx.letterSpacing = "2px";
    
    // Draw background pill
    const pillW = 65;
    const pillH = 18;
    ctx.fillStyle = passed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
    ctx.strokeStyle = brandColor;
    ctx.lineWidth = 1;
    // Round rect helper for pill
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, cy + 24, pillW, pillH, 9);
    ctx.fill();
    ctx.stroke();

    // Text inside pill
    ctx.fillStyle = brandColor;
    ctx.font = "bold 8px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(passed ? "PASS" : "FAIL", cx + 1, cy + 34);

    // Draw thin elegant compass needle pointing to exam pass angle
    const needleAngle = (percentage * 3.6 * Math.PI) / 180;
    const needleLen = radius - 30;
    
    // Northern red needle
    ctx.fillStyle = "#EF4444";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 4 * Math.cos(needleAngle + Math.PI / 2), cy + 4 * Math.sin(needleAngle + Math.PI / 2));
    ctx.lineTo(cx + needleLen * Math.cos(needleAngle), cy + needleLen * Math.sin(needleAngle));
    ctx.closePath();
    ctx.fill();

    // Southern silver needle
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 4 * Math.cos(needleAngle + Math.PI / 2), cy + 4 * Math.sin(needleAngle + Math.PI / 2));
    ctx.lineTo(cx - needleLen * Math.cos(needleAngle), cy - needleLen * Math.sin(needleAngle));
    ctx.closePath();
    ctx.fill();

    // Needle pivot washer
    ctx.fillStyle = "#101214";
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 5. Card Body Headers & Subject Information
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "solid 9px ui-monospace, SFMono-Regular, monospace";
    ctx.letterSpacing = "3px";
    ctx.fillText("FLIGHT SIMULATION DELEBRATION", cx, 30);

    // Subject
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px ui-serif, Georgia, Times New Roman, Times, serif";
    ctx.letterSpacing = "0px";
    ctx.fillText(subjectTitle.toUpperCase(), cx, 400);

    // Questions Ratio
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = "12px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(`ACCURACY: ${score} OF ${totalQuestions} CORRECT`, cx, 430);

    // Candidates Name info
    if (includeName && pilotName.trim()) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = "14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(`PILOT: ${pilotName.toUpperCase()}`, cx, 470);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "italic 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(`PILOT CANDIDATE: ANONYMOUS`, cx, 470);
    }

    // Elegant Outer Border lines
    ctx.strokeStyle = "rgba(250, 204, 21, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    // Bottom Branding Footer
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 15px ui-serif, Georgia, Times, serif";
    ctx.fillText("H E A D I N G", cx, 542);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "8px ui-sans-serif, system-ui, sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("C1 LEVEL SIMULATED PREPARATION FOR COMMERCIAL PILOTS", cx, 562);
  };

  useEffect(() => {
    drawScorecard();
  }, [pilotName, includeName, score, totalQuestions, percentage, subjectTitle, passed]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `heading-scorecard-${percentage}pct.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <Card className="bg-paper border border-rule-strong/60 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-6 items-center">
      
      {/* LEFT: CANVAS PREVIEW */}
      <div className="shrink-0 flex flex-col items-center">
        <div className="relative border border-rule shadow-inner bg-[#101214] rounded-xl overflow-hidden max-w-[280px] sm:max-w-[340px]">
          <canvas
            id="shareableResultCardCanvas"
            ref={canvasRef}
            className="w-full h-auto aspect-square block cursor-pointer transition-all hover:brightness-[1.03]"
            title="Click to download full-res scorecard!"
            role="img"
            aria-label="Score card preview. Click to download full resolution image."
            onClick={handleDownload}
          />
        </div>
        <p className="text-[11px] text-muted-2 mt-2 font-mono uppercase tracking-wider">
          600x600 high-res card preview
        </p>
      </div>

      {/* RIGHT: CONTROLS & INTERACTIVE VALUE PROPOSAL */}
      <div className="flex-1 space-y-4 text-left w-full">
        <div className="space-y-1">
          <span className="font-mono text-[9px] text-navy bg-navy/10 px-2 py-0.5 rounded border border-navy/15 uppercase font-bold tracking-widest inline-flex items-center gap-1">
            <Sparkles size={11} /> Viral Growth Card
          </span>
          <h4 className="font-serif text-lg font-bold text-ink">Generate shareable flight scorecard</h4>
          <p className="text-muted text-[12px] leading-relaxed">
            Commemorate your commercial theory achievements. Download your custom high-fidelity instrumentation cockpit card to share directly on aviation student circles, LinkedIn, or group forums.
          </p>
        </div>

        {/* INPUT FORM CUSTOMIZATION */}
        <div className="space-y-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              id="includeNameCheckbox"
              type="checkbox"
              checked={includeName}
              onChange={(e) => setIncludeName(e.target.checked)}
              className="rounded text-navy border-rule focus:ring-navy w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-ink font-mono uppercase tracking-wider">Stamp My Pilot Name</span>
          </label>

          {includeName && (
            <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
              <input 
                id="shareableResultCardPilotNameInput"
                type="text"
                placeholder="FIRSTNAME LASTNAME"
                value={pilotName}
                onChange={(e) => setPilotName(e.target.value)}
                maxLength={22}
                className="w-full h-9 pl-9 pr-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs uppercase text-ink font-mono transition-all"
              />
            </div>
          )}
        </div>

        {/* DOWNLOAD ACTION */}
        <div className="pt-2">
          <Button 
            id="downloadScorecardBtn"
            variant="primary" 
            onClick={handleDownload}
            className="w-full h-10 rounded-full font-mono text-[11px] uppercase bg-ink hover:bg-ink-2 text-bg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download size={15} /> Download Flight Card
          </Button>
        </div>
      </div>

    </Card>
  );
}
