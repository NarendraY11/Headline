import React, { useState } from "react";
import { Copy, X, Printer } from "lucide-react";

const SPECS: Record<string, { title: string; desc: string }> = {
  "CAPT_SS": {
    title: "CAPTAIN SIDESTICK",
    desc: "Digital Fly-by-wire controller. Transmits pitch and roll displacement transducer signals to computers."
  },
  "FO_SS": {
    title: "F/O SIDESTICK",
    desc: "First Officer Sidestick. Mechanically uncoupled from Captain sidestick. Dual input triggers warning."
  },
  "FCPC1": {
    title: "FCPC 1 (PRIM 1)",
    desc: "Flight Control Primary Computer 1. Computes Normal, Alternate, and Direct flight control laws."
  },
  "FCPC2": {
    title: "FCPC 2 (PRIM 2)",
    desc: "Flight Control Primary Computer 2. Hot-standby. Takes over instantaneously if PRIM 1 fails."
  },
  "FCSC": {
    title: "FCSC 1·2·3 (SEC)",
    desc: "Flight Control Secondary Computers. Provide standby computing for Direct law and rudder trim."
  },
  "AIL": {
    title: "AILERONS (L/R)",
    desc: "Hydraulically actuated, electrically controlled surfaces. Outer trailing edge roll control."
  },
  "SPOILS": {
    title: "SPOILERS",
    desc: "Five panels per wing. Function as roll assist, speed brakes, and ground spoilers. Active hydraulic retraction."
  },
  "ELEV_THS": {
    title: "ELEVATOR & THS",
    desc: "Pitch control. Trimmable Horizontal Stabilizer automatically adjusts for auto-trim in Normal Law."
  },
  "RUDDER": {
    title: "RUDDER",
    desc: "Provides yaw control. Maintains mechanical backup through cable routing to hydraulic actuators."
  },
  "HYD": {
    title: "HYDRAULIC SYSTEMS",
    desc: "Green, Blue, and Yellow triplex architecture operating at 3000 PSI constant pressure. EDMs and PTU."
  }
};

export function FlightControlsDiagram() {
  const [hoveredNodes, setHoveredNodes] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [blueprintMode, setBlueprintMode] = useState<boolean>(false);
  
  const LAWS = ['NORMAL LAW', 'ALTERNATE LAW', 'DIRECT LAW'];
  const [lawIdx, setLawIdx] = useState(0);

  const handleEnter = (id: string) => setHoveredNodes([id]);
  const handleLeave = () => setHoveredNodes([]);

  const togglePin = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinned(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSVGClick = () => {
    // Optional: click outside clears all pinned
    // setPinned([]);
  };

  const handleShare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set('sys', id);
    navigator.clipboard.writeText(url.toString());
    // Could add toast here
  };

  const NODES = [
    { id: 'CAPT_SS', label: "CAPT SS", x: 40, y: 85, w: 80, h: 30, cx: 80, cy: 100 },
    { id: 'FO_SS', label: "F/O SS", x: 40, y: 205, w: 80, h: 30, cx: 80, cy: 220 },
    { id: 'FCPC1', label: "FCPC 1 (PRIM 1)", x: 220, y: 85, w: 100, h: 30, cx: 270, cy: 100 },
    { id: 'FCSC', label: "FCSC 1·2·3", x: 220, y: 145, w: 100, h: 30, cx: 270, cy: 160 },
    { id: 'FCPC2', label: "FCPC 2 (PRIM 2)", x: 220, y: 205, w: 100, h: 30, cx: 270, cy: 220 },
    { id: 'AIL', label: "L AIL", x: 420, y: 65, w: 80, h: 30, cx: 460, cy: 80 },
    { id: 'SPOILS', label: "L SPOIL", x: 420, y: 115, w: 80, h: 30, cx: 460, cy: 130 },
    { id: 'ELEV_THS', label: "ELEV · THS", x: 420, y: 165, w: 80, h: 30, cx: 460, cy: 180 },
    { id: 'RUDDER', label: "RUDDER", x: 420, y: 215, w: 80, h: 30, cx: 460, cy: 230 },
    { id: 'HYD', label: "G·B·Y", x: 530, y: 130, w: 30, h: 60, cx: 545, cy: 160 },
  ];

  const PATHS = [
    { id: 'p1', d: "M 120 100 L 220 100", nodes: ['CAPT_SS', 'FCPC1'] },
    { id: 'p2', d: "M 120 100 L 160 100 L 220 160", nodes: ['CAPT_SS', 'FCSC'] },
    { id: 'p3', d: "M 120 100 L 160 100 L 220 220", isDashed: true, nodes: ['CAPT_SS', 'FCPC2'] },
    { id: 'p4', d: "M 120 220 L 220 220", nodes: ['FO_SS', 'FCPC2'] },
    { id: 'p5', d: "M 120 220 L 160 220 L 220 160", nodes: ['FO_SS', 'FCSC'] },
    { id: 'p6', d: "M 120 220 L 160 220 L 220 100", isDashed: true, nodes: ['FO_SS', 'FCPC1'] },
    { id: 'p7', d: "M 320 100 L 420 80", nodes: ['FCPC1', 'AIL'] },
    { id: 'p8', d: "M 320 100 L 420 130", nodes: ['FCPC1', 'SPOILS'] },
    { id: 'p9', d: "M 320 100 L 420 180", nodes: ['FCPC1', 'ELEV_THS'] },
    { id: 'p10', d: "M 320 160 L 420 130", nodes: ['FCSC', 'SPOILS'] },
    { id: 'p11', d: "M 320 160 L 420 180", nodes: ['FCSC', 'ELEV_THS'] },
    { id: 'p12', d: "M 320 220 L 450 180", isDashed: true, nodes: ['FCPC2', 'ELEV_THS'] },
    { id: 'p13', d: "M 320 220 L 420 230", nodes: ['FCPC2', 'RUDDER'] },
    { id: 'p14', d: "M 500 80 L 530 150", nodes: ['AIL', 'HYD'] },
    { id: 'p15', d: "M 500 130 L 530 150", nodes: ['SPOILS', 'HYD'] },
    { id: 'p16', d: "M 500 180 L 530 160", nodes: ['ELEV_THS', 'HYD'] },
    { id: 'p17', d: "M 500 230 L 530 170", nodes: ['RUDDER', 'HYD'] },
  ];

  return (
    <div className={`FlightControlsDiagram w-full h-full min-h-[300px] rounded-xl overflow-hidden relative border flex flex-col ${blueprintMode ? 'bg-[#ffffff] border-ink/20' : 'bg-panel border-rule/50'}`}>
      <div className="absolute top-4 left-4 z-20">
        <button 
          onClick={() => setBlueprintMode(!blueprintMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-mono tracking-widest uppercase transition-colors ${blueprintMode ? 'bg-ink text-white border-ink' : 'bg-bg text-ink-2 border-rule hover:bg-bg-2'}`}
        >
          <Printer size={12} />
          Blueprint Mode
        </button>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <button 
          onClick={() => setLawIdx(prev => (prev + 1) % LAWS.length)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-mono tracking-widest uppercase transition-colors ${
            LAWS[lawIdx] === 'NORMAL LAW' ? 'bg-mint/10 text-mint border-mint/20 hover:bg-mint/20' : 
            LAWS[lawIdx] === 'ALTERNATE LAW' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' : 
            'bg-signal/10 text-signal border-signal/20 hover:bg-signal/20'
          }`}
          title="Toggle Simulator State (Demonstration)"
        >
          {LAWS[lawIdx] === 'NORMAL LAW' && <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />}
          {LAWS[lawIdx] === 'ALTERNATE LAW' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          {LAWS[lawIdx] === 'DIRECT LAW' && <span className="w-1.5 h-1.5 rounded-full bg-signal" />}
          FCPC: {LAWS[lawIdx]}
        </button>
      </div>

      <div className="absolute inset-x-0 top-6 flex justify-center z-10 pointer-events-none">
         <div className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded-full backdrop-blur-sm border ${blueprintMode ? 'bg-white/90 text-ink/70 border-ink/20' : 'text-muted-2 bg-bg/80 border-rule/50'}`}>
           Click components or paths to pin specs & trace signals
         </div>
      </div>

      <div className={`absolute bottom-4 left-4 md:bottom-6 md:left-6 z-20 flex flex-col gap-1.5 p-3 md:p-4 rounded-xl border backdrop-blur-md shadow-sm transition-colors duration-300 pointer-events-none ${
        blueprintMode ? 'bg-white/80 border-ink/30 text-ink' :
        lawIdx === 0 ? 'bg-mint/5 border-mint/40 text-mint' : 
        lawIdx === 1 ? 'bg-amber-500/5 border-amber-500/40 text-amber-500' : 
        'bg-signal/5 border-signal/40 text-signal'
      }`}>
        <span className={`font-mono text-[9px] uppercase tracking-widest ${blueprintMode ? 'opacity-60' : 'opacity-80'}`}>System Readiness</span>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider font-semibold">
           {!blueprintMode && <span className={`w-2 h-2 rounded-full shrink-0 ${
             lawIdx === 0 ? 'bg-mint animate-pulse' : 
             lawIdx === 1 ? 'bg-amber-500' : 
             'bg-signal'
           }`} />}
           <span>{lawIdx === 0 ? 'SIGNAL CONN: NORMAL' : lawIdx === 1 ? 'SIGNAL CONN: DEGRADED (ALT)' : 'SIGNAL CONN: DIRECT (MANUAL)'}</span>
        </div>
      </div>

      <div role="button" tabIndex={0} aria-label="Interactive flight controls diagram — activate to explore aircraft systems" onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} className="relative w-full max-w-[800px] aspect-[2/1] mx-auto z-0 mt-12 md:mt-16 mb-4 md:mb-8" onClick={handleSVGClick}>
        <svg className={`absolute inset-0 w-full h-full ${blueprintMode ? '' : 'drop-shadow-sm'}`} viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet">
          <g stroke="var(--ink)" strokeWidth="1.5" fill="none" opacity={blueprintMode ? "0.2" : "0.4"}>
            {PATHS.map(p => (
              <path key={`base-${p.id}`} d={p.d} strokeDasharray={p.isDashed ? "4 4" : "none"} />
            ))}
          </g>

          {PATHS.map(p => {
             const activeNode = p.nodes.some(n => pinned.includes(n) || hoveredNodes.includes(n));
             const isSimulatedActive = (lawIdx > 0) && p.nodes.some(n => (n === 'FCSC' || n === 'FCPC2'));
             const isHoveredPath = hoveredPath === p.id;
             const isFailedNodePath = (lawIdx > 0) && p.nodes.includes('FCPC1');
             
             // If failed, hovering FCPC1 won't trace
             const isActive = (activeNode && !isFailedNodePath) || isHoveredPath || isSimulatedActive;
             
             let traceColor = blueprintMode ? 'var(--ink)' : 'var(--sky)';
             if (isSimulatedActive && !blueprintMode) {
               traceColor = lawIdx === 1 ? 'var(--amber)' : '#ef4444'; // amber or red(signal)
             }
             const highlightColor = traceColor;

             return (
               <g key={`trace-${p.id}`}>
                 <path 
                   d={p.d} 
                   stroke="transparent" 
                   strokeWidth="15" 
                   fill="none" 
                   className="cursor-pointer"
                   onMouseEnter={() => {
                     setHoveredPath(p.id);
                     setHoveredNodes(p.nodes);
                   }}
                   onMouseLeave={() => {
                     setHoveredPath(null);
                     setHoveredNodes([]);
                   }}
                   onClick={(e) => {
                     e.stopPropagation();
                     const allPinned = p.nodes.every(n => pinned.includes(n));
                     setPinned(prev => {
                       let next = new Set(prev);
                       if (allPinned) {
                         p.nodes.forEach(n => next.delete(n));
                       } else {
                         p.nodes.forEach(n => next.add(n));
                       }
                       return Array.from(next);
                     });
                   }}
                 />

                 {isActive && (
                   <>
                     <path 
                        d={p.d} 
                        stroke={highlightColor}
                        strokeWidth={blueprintMode ? "2" : "1.5"} 
                        fill="none" 
                        opacity={blueprintMode ? "1" : "0.8"} 
                        strokeDasharray={p.isDashed ? "4 4" : "none"} 
                        className="transition-colors duration-300 pointer-events-none"
                        style={!blueprintMode && isHoveredPath ? { filter: 'drop-shadow(0 0 6px var(--sky))' } : {}}
                     />
                     {!blueprintMode && (
                       <path
                          d={p.d}
                          stroke={highlightColor}
                          strokeWidth={isSimulatedActive ? "3.5" : "3"}
                          fill="none"
                          strokeDasharray={isSimulatedActive ? "8 16" : "6 12"}
                          className="dash-flow pointer-events-none"
                          style={{
                            ['--dash-start' as string]: isSimulatedActive ? 24 : 18,
                            ['--dash-dur' as string]: isSimulatedActive ? '0.3s' : '0.6s',
                            ...(isHoveredPath || isSimulatedActive ? { filter: `drop-shadow(0 0 ${isSimulatedActive ? '12px' : '8px'} ${highlightColor})` } : {})
                          }}
                       />
                     )}
                   </>
                 )}
               </g>
             );
          })}

          <text x="60" y="70" fontSize="8" fill={blueprintMode ? "var(--ink)" : "var(--muted)"} opacity={blueprintMode ? "0.6" : "1"} fontFamily="monospace" textAnchor="middle" className="pointer-events-none">SIDESTICKS</text>
          <text x="270" y="70" fontSize="8" fill={blueprintMode ? "var(--ink)" : "var(--muted)"} opacity={blueprintMode ? "0.6" : "1"} fontFamily="monospace" textAnchor="middle" className="pointer-events-none">COMPUTERS</text>
          <text x="460" y="50" fontSize="8" fill={blueprintMode ? "var(--ink)" : "var(--muted)"} opacity={blueprintMode ? "0.6" : "1"} fontFamily="monospace" textAnchor="middle" className="pointer-events-none">SURFACES</text>
          <text x="545" y="120" fontSize="8" fill={blueprintMode ? "var(--ink)" : "var(--muted)"} opacity={blueprintMode ? "0.6" : "1"} fontFamily="monospace" textAnchor="middle" className="pointer-events-none">HYDRAULICS</text>

          {NODES.map(node => {
            const isHovered = hoveredNodes.includes(node.id);
            const isPinned = pinned.includes(node.id);
            const isFailed = (lawIdx > 0) && node.id === 'FCPC1';
            const isActive = (isHovered || isPinned) && !isFailed;
            
            let nodeFill = blueprintMode ? (isActive ? 'var(--ink)' : 'var(--white)') : 'var(--paper)';
            let textFill = blueprintMode ? (isActive ? 'var(--white)' : 'var(--ink)') : (isActive ? 'var(--sky)' : 'var(--ink)');
            let strokeColor = blueprintMode ? 'var(--ink)' : (isActive ? 'var(--sky)' : 'var(--ink)');
            const strokeWidth = isActive ? (blueprintMode ? "2.5" : "2") : (blueprintMode ? "1" : "1.5");

            if (isFailed) {
              nodeFill = blueprintMode ? 'var(--white)' : 'rgba(239, 68, 68, 0.1)';
              textFill = blueprintMode ? 'var(--ink-40, #9ca3af)' : 'var(--signal, #ef4444)';
              strokeColor = blueprintMode ? 'var(--ink-40, #9ca3af)' : 'var(--signal, #ef4444)';
            }

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => handleEnter(node.id)}
                onMouseLeave={handleLeave}
                onClick={(e) => togglePin(node.id, e as any)}
                className="cursor-pointer"
              >
                <rect 
                  width={node.w} 
                  height={node.h} 
                  rx="4" 
                  fill={nodeFill}
                  stroke={strokeColor} 
                  strokeWidth={strokeWidth} 
                  className="transition-all duration-300"
                />
                <text 
                  x={node.w / 2} 
                  y={node.h / 2 + 4} 
                  fontSize="10" 
                  fill={textFill} 
                  fontFamily="monospace" 
                  textAnchor="middle" 
                  className="transition-colors duration-300 pointer-events-none font-semibold"
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="absolute inset-0 pointer-events-none">
            {[...new Set([...pinned, ...hoveredNodes])].filter(Boolean).map((id) => {
              const node = NODES.find(n => n.id === id);
              if (!node) return null;
              const spec = SPECS[id as keyof typeof SPECS];
              if (!spec) return null;
              
              const left = (node.cx / 600) * 100;
              const top = (node.cy / 300) * 100;
              
              const isAbove = node.cy >= 150;
              let align = '-50%';
              if (node.cx < 150) align = '0%';
              if (node.cx > 450) align = '-100%';
              
              const transformY = isAbove ? 'calc(-100% - 24px)' : '24px';

              return (
                <div
                  key={`tt-${id}`}
                  className={`anim-fade absolute z-30 pointer-events-auto rounded-xl p-4 shadow-xl backdrop-blur-md ${blueprintMode ? 'bg-white border-2 border-ink' : 'bg-bg/95 border border-sky/30'}`}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: `translate(${align}, ${transformY})`,
                    width: 'max-content',
                    maxWidth: '220px'
                  }}
                >
                  <div className="flex justify-between items-start mb-2 gap-4">
                    <div className={`font-mono text-[10px] tracking-widest uppercase flex items-center gap-2 font-semibold ${blueprintMode ? 'text-ink' : 'text-sky'}`}>
                      {!blueprintMode && <span className="w-1.5 h-1.5 rounded-full bg-sky animate-pulse shrink-0" />}
                      {spec.title}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
                      <button onClick={(e) => handleShare(id as string, e)} className={`p-1 transition-colors ${blueprintMode ? 'text-ink/60 hover:text-ink' : 'text-muted hover:text-sky'}`} title="Share deep-link">
                        <Copy size={12} />
                      </button>
                      {pinned.includes(id as string) && (
                        <button onClick={(e) => togglePin(id as string, e as any)} className={`p-1 transition-colors ${blueprintMode ? 'text-ink/60 hover:text-ink' : 'text-muted hover:text-ink'}`} title="Close interaction">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className={`font-sans text-[11px] leading-relaxed ${blueprintMode ? 'text-ink font-mono' : 'text-ink-2'}`}>{spec.desc}</p>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
