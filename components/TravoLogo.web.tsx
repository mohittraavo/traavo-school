import React from 'react';
import { useTheme } from '../theme/ThemeContext';

export default function TravoLogo({ size = 36 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" fill="none" aria-hidden="true">
      <line x1="34" y1="56" x2="170" y2="56" stroke={colors.logoNavy} strokeWidth="24" strokeLinecap="round" />
      <line x1="110" y1="56" x2="110" y2="107" stroke={colors.logoNavy} strokeWidth="24" strokeLinecap="round" />
      <path d="M110,107 C126,161 170,161 196,24" fill="none" stroke={colors.brand} strokeWidth="24" strokeLinecap="round" />
    </svg>
  );
}
