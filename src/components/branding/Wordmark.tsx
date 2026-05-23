import React from 'react';
import { CompassLogo } from './CompassLogo';

export const Wordmark: React.FC = () => {
  return (
    <div className="flex items-center gap-3">
      <CompassLogo size={28} color="var(--navy)" />
      <div className="flex flex-col">
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', lineHeight: 1, color: 'var(--ink)' }}>
          Heading
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.05em' }}>
          FL · 380
        </span>
      </div>
    </div>
  );
};
