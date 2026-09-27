/**
 * Icons — inline SVG icon components.
 *
 * All icons are 16×16 (default), stroke-based, use `currentColor` so they
 * inherit text colour from the parent. Override size via the `size` prop.
 *
 * Usage:
 *   <IconSun size={18} />
 *   <IconDownload />
 */

function Svg({ size = 16, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ── Theme ───────────────────────────────────────────────────────────────── */

export function IconSun({ size }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
      <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22" />
    </Svg>
  );
}

export function IconMoon({ size }) {
  return (
    <Svg size={size}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  );
}

/* ── Actions ─────────────────────────────────────────────────────────────── */

export function IconDownload({ size }) {
  return (
    <Svg size={size}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

export function IconFilter({ size }) {
  return (
    <Svg size={size}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </Svg>
  );
}

export function IconX({ size }) {
  return (
    <Svg size={size}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </Svg>
  );
}

/* ── Navigation ──────────────────────────────────────────────────────────── */

export function IconChevronLeft({ size }) {
  return (
    <Svg size={size}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function IconChevronRight({ size }) {
  return (
    <Svg size={size}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

/* ── Status / Alerts ─────────────────────────────────────────────────────── */

export function IconAlertTriangle({ size }) {
  return (
    <Svg size={size}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

export function IconCheckCircle({ size }) {
  return (
    <Svg size={size}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </Svg>
  );
}

export function IconShield({ size }) {
  return (
    <Svg size={size} strokeWidth="1.6">
      <path d="M12 2L4 5.5V11c0 4.97 3.4 9.63 8 10.93C16.6 20.63 20 15.97 20 11V5.5L12 2Z"
        fill="currentColor" fillOpacity="0.12" />
      <path d="M12 2L4 5.5V11c0 4.97 3.4 9.63 8 10.93C16.6 20.63 20 15.97 20 11V5.5L12 2Z" />
      <polyline points="9 12 11 14 15 10" strokeWidth="1.8" />
    </Svg>
  );
}

/* ── Metric-specific ─────────────────────────────────────────────────────── */

/** AI brain / provenance */
export function IconBrain({ size }) {
  return (
    <Svg size={size}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14z" />
    </Svg>
  );
}

/** License / document */
export function IconFileText({ size }) {
  return (
    <Svg size={size}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </Svg>
  );
}

/** Vulnerability / bug */
export function IconBug({ size }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="8" height="14" rx="4" ry="4" />
      <path d="M19 7l-3 2" />
      <path d="M5 7l3 2" />
      <path d="M19 12h-3" />
      <path d="M5 12h3" />
      <path d="M19 17l-3-2" />
      <path d="M5 17l3-2" />
      <path d="M12 6V3" />
    </Svg>
  );
}

/** Phantom package / ghost */
export function IconGhost({ size }) {
  return (
    <Svg size={size}>
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </Svg>
  );
}

/** Tamper evidence / fingerprint lock */
export function IconLock({ size }) {
  return (
    <Svg size={size}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}
