import React, { ReactNode } from "react";

// COMPASS / HSI SVG LOGOMARK
export interface CompassLogomarkProps {
  size?: number | string;
  className?: string;
  color?: string;
  pointerColor?: string;
  baseAngle?: number;
  spin?: "drift" | "seek" | "rotate" | "none";
  spinDuration?: number;
  style?: React.CSSProperties;
}

export function CompassLogomark({
  size = 40,
  className = "",
  color = "currentColor",
  pointerColor = "var(--signal)",
  baseAngle = 30,
  spin = "drift",
  spinDuration,
  style,
}: CompassLogomarkProps) {
  // Generate 24 tick marks spaced 15 degrees apart
  const ticks = Array.from({ length: 24 }).map((_, i) => {
    const isMajor = i % 6 === 0;
    const angle = i * 15;
    const y2 = isMajor ? 14 : 9; // Major ticks are longer
    return (
      <line
        key={i}
        x1="50"
        y1="5"
        x2="50"
        y2={y2}
        stroke={color}
        strokeWidth={isMajor ? "1.5" : "0.75"}
        transform={`rotate(${angle}, 50, 50)`}
        style={{ transformOrigin: "50px 50px" }}
      />
    );
  });

  const animId = React.useId().replace(/:/g, "");
  const animationName = `compassAnim-${animId}`;

  let keyframes = "";
  let animStyle = "";

  if (spin === "drift") {
    const a0 = baseAngle - 1.2;
    const a1 = baseAngle + 1.4;
    const a2 = baseAngle - 0.5;
    const a3 = baseAngle + 0.9;
    keyframes = `
      @keyframes ${animationName} {
        0% { transform: rotate(${a0}deg); }
        25% { transform: rotate(${a1}deg); }
        50% { transform: rotate(${a2}deg); }
        75% { transform: rotate(${a3}deg); }
        100% { transform: rotate(${a0}deg); }
      }
    `;
    animStyle = `
      animation: ${animationName} ${spinDuration || 9}s ease-in-out infinite;
      transform: rotate(${a0}deg); /* fallback */
    `;
  } else if (spin === "seek") {
    keyframes = `
      @keyframes ${animationName} {
        0% { transform: rotate(${baseAngle - 140}deg); }
        60% { transform: rotate(${baseAngle + 4}deg); }
        80% { transform: rotate(${baseAngle - 1.5}deg); }
        100% { transform: rotate(${baseAngle}deg); }
      }
    `;
    animStyle = `
      animation: ${animationName} ${spinDuration || 1.4}s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      transform: rotate(${baseAngle - 140}deg); /* start state before anim */
    `;
  } else if (spin === "rotate") {
    keyframes = `
      @keyframes ${animationName} {
        0% { transform: rotate(${baseAngle}deg); }
        100% { transform: rotate(${baseAngle + 360}deg); }
      }
    `;
    animStyle = `
      animation: ${animationName} ${spinDuration || 10}s linear infinite;
      transform: rotate(${baseAngle}deg); /* fallback */
    `;
  } else {
    animStyle = `transform: rotate(${baseAngle}deg);`;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`inline-block select-none ${className}`}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: typeof size === "number" ? `${size}px` : size,
        maxHeight: typeof size === "number" ? `${size}px` : size,
        aspectRatio: "1 / 1",
        verticalAlign: "middle",
        ...style,
      }}
      aria-hidden="true"
    >
      {spin !== "none" && (
        <style>{`
          ${keyframes}
          .${animationName}-needle {
            transform-origin: 50px 50px;
            ${animStyle}
          }
          @media (prefers-reduced-motion: reduce) {
            .${animationName}-needle {
              animation: none !important;
              transform: rotate(${baseAngle}deg) !important;
            }
          }
        `}</style>
      )}
      {spin === "none" && (
        <style>{`
          .${animationName}-needle {
            transform-origin: 50px 50px;
            ${animStyle}
          }
        `}</style>
      )}

      {/* Outer Circle Container */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      
      {/* 24 Tick Marks around perimeter */}
      <g style={{ transformOrigin: "50px 50px" }}>{ticks}</g>
      
      {/* Inner subtle circle */}
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        strokeDasharray="2, 2"
        className="opacity-40"
      />

      {/* Compass Needle with gentle drift rotation animation */}
      <g className={`${animationName}-needle`}>
        {/* North Pointer (pointing North-ish, styled elegantly) */}
        {/* LEFT NORTH TIP - filled darker */}
        <polygon
          points="50,50 46,50 50,15"
          fill={pointerColor}
          opacity="0.95"
        />
        {/* RIGHT NORTH TIP - slightly translucent for premium contrast */}
        <polygon
          points="50,50 54,50 50,15"
          fill={pointerColor}
          opacity="0.75"
        />

        {/* South Pointer */}
        {/* LEFT SOUTH TIP */}
        <polygon
          points="50,50 46,50 50,85"
          fill={color}
          opacity="0.4"
        />
        {/* RIGHT SOUTH TIP */}
        <polygon
          points="50,50 54,50 50,85"
          fill={color}
          opacity="0.2"
        />

        {/* Central Pivot */}
        <circle
          cx="50"
          cy="50"
          r="4.5"
          fill="var(--panel, #fbfaf6)"
          stroke={color}
          strokeWidth="1.5"
        />
        <circle
          cx="50"
          cy="50"
          r="1.5"
          fill={pointerColor}
        />
      </g>
    </svg>
  );
}

// WORDMARK COMPONENT
export interface WordmarkProps {
  className?: string;
  compassSize?: number;
  hideText?: boolean;
  logomark?: React.ReactNode;
  logomarkProps?: Partial<CompassLogomarkProps>;
}

export function Wordmark({ 
  className = "", 
  compassSize = 30, 
  hideText = false,
  logomark,
  logomarkProps
}: WordmarkProps) {
  const renderedLogomark = logomark !== undefined ? logomark : (
    <CompassLogomark 
      size={compassSize} 
      className="text-ink flex-shrink-0" 
      {...logomarkProps} 
    />
  );

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {renderedLogomark}
      {!hideText && (
        <div className="flex items-baseline gap-1.5 whitespace-nowrap group">
          <span className="wordmark-heading-title font-serif text-[24px]">
            Heading
          </span>
          <span className="font-mono font-[400] text-[9px] bg-bg-2 px-1.5 py-0.5 rounded-sm print:border print:border-rule" style={{ color: "var(--muted)" }}>
            FL · 380
          </span>
        </div>
      )}
    </div>
  );
}

// BUTTON ATOM
export interface ButtonProps {
  variant?: "primary" | "ghost" | "paper";
  children: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
  [key: string]: any;
}

export function Button({
  variant = "primary",
  children,
  className = "",
  type = "button",
  style,
  ...props
}: ButtonProps) {
  let baseStyles = "Button h-[44px] rounded-full font-sans font-medium text-[14px] px-6 select-none flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2";
  
  let variantStyles = "";
  if (variant === "primary") {
    // ink bg, parchment text
    variantStyles = "btn-primary bg-ink text-bg hover:bg-ink-2 font-medium";
  } else if (variant === "ghost") {
    // transparent + border
    variantStyles = "bg-transparent text-ink border border-rule-strong hover:bg-bg-2";
  } else if (variant === "paper") {
    // white bg
    variantStyles = "bg-paper text-ink border border-rule hover:border-rule-strong shadow-[0_1px_2px_rgba(13,26,45,0.02)]";
  }

  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </button>
  );
}

// CHIP ATOM
export type ChipVariant = "default" | "solid" | "signal" | "amber" | "mint" | "sky";

export interface ChipProps {
  variant?: ChipVariant;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}

export function Chip({ variant = "default", children, className = "", style, ...props }: ChipProps) {
  const baseStyles = "h-[26px] rounded-full font-mono text-[11px] font-medium uppercase px-3 tracking-wider inline-flex items-center justify-center whitespace-nowrap select-none";
  
  let variantStyles = "";
  switch (variant) {
    case "solid":
      variantStyles = "bg-ink text-paper";
      break;
    case "signal":
      // Light: deepen red text — base --signal is only 3.8:1 on signal-soft. Dark token already passes.
      variantStyles = "bg-signal-soft text-[#a83020] dark:text-signal border border-signal/10";
      break;
    case "amber":
      // Light: deepen amber text — base --amber is only 4.2:1 on amber-soft. Dark token already passes.
      variantStyles = "bg-amber-soft text-[#855807] dark:text-amber border border-amber/10";
      break;
    case "mint":
      variantStyles = "bg-mint-soft text-mint border border-mint/10";
      break;
    case "sky":
      variantStyles = "bg-sky-soft text-sky border border-sky/10";
      break;
    case "default":
    default:
      variantStyles = "bg-bg-2 text-ink-2 border border-rule";
      break;
  }

  return (
    <span className={`${baseStyles} ${variantStyles} ${className}`} style={style} {...props}>
      {children}
    </span>
  );
}

// CARD ATOM
export interface CardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}

export function Card({ children, className = "", style = {}, ...props }: CardProps) {
  return (
    <div
      className={`bg-paper border border-rule-strong p-6 md:p-8 shadow-[0_1px_2px_rgba(13,26,45,0.04),0_8px_24px_-8px_rgba(13,26,45,0.10)] opacity-100 relative ${className}`}
      style={{
        borderRadius: "var(--r-lg)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

// HORIZONTAL RULE ATOM
export function HR({ className = "" }: { className?: string }) {
  return <hr className={`border-0 h-[1px] bg-rule w-full my-6 block ${className}`} />;
}
