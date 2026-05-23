import React from "react";

export function FlightControlsDiagram() {
  return (
    <div className="w-full h-full min-h-[300px] bg-panel rounded-xl overflow-hidden p-6 relative border border-rule/50">
      <svg className="w-full h-full" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet">
        {/* Lines */}
        <g stroke="var(--ink)" strokeWidth="1.5" fill="none">
          {/* Capt SS to Computers */}
          <path d="M 120 100 L 220 100" />
          <path d="M 120 100 L 160 100 L 220 160" />
          <path d="M 120 100 L 160 100 L 220 220" strokeDasharray="4 4" />
          
          {/* F/O SS to Computers */}
          <path d="M 120 220 L 220 220" />
          <path d="M 120 220 L 160 220 L 220 160" />
          <path d="M 120 220 L 160 220 L 220 100" strokeDasharray="4 4" />

          {/* Computers to Surfaces */}
          <path d="M 320 100 L 420 80" />
          <path d="M 320 100 L 420 130" />
          <path d="M 320 100 L 420 180" />
          
          <path d="M 320 160 L 420 130" />
          <path d="M 320 160 L 420 180" />

          <path d="M 320 220 L 450 180" strokeDasharray="4 4" />
          <path d="M 320 220 L 420 230" />

          {/* Surfaces to Hydraulics */}
          <path d="M 500 80 L 530 150" />
          <path d="M 500 130 L 530 150" />
          <path d="M 500 180 L 530 160" />
          <path d="M 500 230 L 530 170" />
        </g>

        {/* Labels for groups */}
        <text x="60" y="70" fontSize="8" fill="var(--muted)" fontFamily="monospace" textAnchor="middle">SIDESTICKS</text>
        <text x="270" y="70" fontSize="8" fill="var(--muted)" fontFamily="monospace" textAnchor="middle">COMPUTERS</text>
        <text x="460" y="50" fontSize="8" fill="var(--muted)" fontFamily="monospace" textAnchor="middle">SURFACES</text>
        <text x="545" y="120" fontSize="8" fill="var(--muted)" fontFamily="monospace" textAnchor="middle">HYDRAULICS</text>

        {/* Capt SS */}
        <g transform="translate(40, 85)">
          <rect width="80" height="30" rx="4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="40" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">CAPT SS</text>
        </g>
        
        {/* F/O SS */}
        <g transform="translate(40, 205)">
          <rect width="80" height="30" rx="4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="40" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">F/O SS</text>
        </g>

        {/* Computers */}
        <g transform="translate(220, 85)">
          <rect width="100" height="30" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="50" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">FCPC 1 (PRIM 1)</text>
        </g>
        <g transform="translate(220, 145)">
          <rect width="100" height="30" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="50" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">FCSC 1·2·3</text>
        </g>
        <g transform="translate(220, 205)">
          <rect width="100" height="30" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="50" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">FCPC 2 (PRIM 2)</text>
        </g>

        {/* Surfaces */}
        <g transform="translate(420, 65)">
          <rect width="80" height="30" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="40" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">L AIL</text>
        </g>
        <g transform="translate(420, 115)">
          <rect width="80" height="30" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="40" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">L SPOIL</text>
        </g>
        <g transform="translate(420, 165)">
          <rect width="80" height="30" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="40" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">ELEV · THS</text>
        </g>
        <g transform="translate(420, 215)">
          <rect width="80" height="30" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="40" y="19" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">RUDDER</text>
        </g>

        {/* Hydraulics */}
        <g transform="translate(530, 130)">
          <rect width="30" height="60" rx="4" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x="15" y="34" fontSize="10" fill="var(--ink)" fontFamily="monospace" textAnchor="middle">G·B·Y</text>
        </g>
      </svg>
    </div>
  );
}
