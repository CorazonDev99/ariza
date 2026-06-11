import type { SVGProps } from 'react';

/**
 * Minimal Lucide-style line icons (24×24, 2px stroke, currentColor).
 * Inlined so the Mini App keeps zero icon-lib deps. Each icon inherits
 * its color from `currentColor`, so set it via the parent's text color.
 */
type IconProps = SVGProps<SVGSVGElement>;

const svg = (props: IconProps) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

/** Document — "Ariza topshirish". */
export const IconFile = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);

/** Clipboard with check — "Ishimni tekshirish". */
export const IconCaseCheck = (p: IconProps) => (
  <svg {...svg(p)}>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

/** Open book — "Qoʻllanma". */
export const IconBook = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </svg>
);

/** Courthouse — "Sudlar maʼlumoti". */
export const IconLandmark = (p: IconProps) => (
  <svg {...svg(p)}>
    <line x1="3" x2="21" y1="22" y2="22" />
    <line x1="6" x2="6" y1="18" y2="11" />
    <line x1="10" x2="10" y1="18" y2="11" />
    <line x1="14" x2="14" y1="18" y2="11" />
    <line x1="18" x2="18" y1="18" y2="11" />
    <polygon points="12 2 20 7 4 7" />
  </svg>
);

/** Scales of justice — brand mark. */
export const IconScale = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
);

/** Sparkles — AI assistant ("AI-Yurist"). */
export const IconSparkles = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="M9.94 14.06A2 2 0 0 0 8.5 12.6l-5.2-1.34a.5.5 0 0 1 0-.96L8.5 8.94A2 2 0 0 0 9.94 7.5l1.34-5.2a.5.5 0 0 1 .96 0L13.56 7.5A2 2 0 0 0 15 8.94l5.2 1.34a.5.5 0 0 1 0 .96L15 12.6a2 2 0 0 0-1.44 1.46l-1.34 5.2a.5.5 0 0 1-.96 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  </svg>
);

/** Gear — "Sozlamalar". */
export const IconSettings = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="M20 7h-9" />
    <path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" />
    <circle cx="7" cy="7" r="3" />
  </svg>
);

export const IconChevron = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/** Up-arrow — send button. */
export const IconSend = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
);
