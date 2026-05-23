import React from 'react';

interface CompassLogoProps {
  size?: number;
  className?: string;
  color?: string;
}

export const CompassLogo: React.FC<CompassLogoProps> = ({ 
  size = 24, 
  className = '', 
  color = 'currentColor' 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="50" cy="50" r="45" stroke={color} strokeWidth="4" />
      {/* 24 ticks = 360 / 24 = 15 degrees each */}
      {Array.from({ length: 24 }).map((_, i) => {
        const isLong = i % 6 === 0;
        const length = isLong ? 12 : 6;
        const transform = `rotate(${i * 15} 50 50)`;
        return (
          <line 
            key={i} 
            x1="50" 
            y1="5" 
            x2="50" 
            y2={5 + length} 
            stroke={color} 
            strokeWidth={isLong ? "3" : "2"} 
            transform={transform} 
          />
        );
      })}
      {/* Needle pointing 030° (which is 30 degrees clockwise from North/Top) */}
      <g transform="rotate(30 50 50)">
        <path d="M50 15 L55 50 L50 85 L45 50 Z" fill={color} />
      </g>
    </svg>
  );
};
