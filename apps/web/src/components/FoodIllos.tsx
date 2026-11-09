type IlloProps = {
  className?: string;
};

/** Cartoon food SVGs — clean shapes, soft highlights, shared palette. */

const INK = '#1E1B4B';
const SHADOW = 'rgba(30, 27, 75, 0.12)';

function SoftShadow({ cx = 80, cy = 128, rx = 44 }: { cx?: number; cy?: number; rx?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={7.5} fill={SHADOW} />;
}

export function IlloBurger({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <SoftShadow rx={48} />
      {/* bun top */}
      <path
        d="M30 64c0-26 22.5-44 50-44s50 18 50 44H30Z"
        fill="#FFB347"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M42 42c8-10 22-16 38-16 10 0 20 2.5 28 7"
        stroke="#FFF6E0"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* seeds */}
      <ellipse cx="48" cy="44" rx="3.2" ry="2.1" fill="#E76F51" transform="rotate(-18 48 44)" />
      <ellipse cx="70" cy="36" rx="3" ry="2" fill="#E76F51" transform="rotate(12 70 36)" />
      <ellipse cx="94" cy="38" rx="3.2" ry="2.1" fill="#E76F51" transform="rotate(-8 94 38)" />
      <ellipse cx="112" cy="48" rx="2.6" ry="1.8" fill="#E76F51" transform="rotate(20 112 48)" />
      {/* tomato */}
      <path d="M32 64h96v9H32z" fill="#EF5B4A" stroke={INK} strokeWidth="2.5" />
      {/* lettuce */}
      <path
        d="M34 73c7 9 18 13 46 13s39-4 46-13H34Z"
        fill="#3CBF8A"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M48 78c6 3 12 4 20 3M92 79c6 2 12 2 18 0" stroke="#2A9D6E" strokeWidth="2" strokeLinecap="round" />
      {/* cheese */}
      <path
        d="M36 84h88l-6 10H42L36 84Z"
        fill="#FFD43B"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* bun bottom */}
      <path
        d="M34 96c8 16 26 26 46 26s38-10 46-26H34Z"
        fill="#F4A261"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M48 104c10 4 22 6 32 5" stroke="#FFF6E0" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function IlloBowl({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <SoftShadow rx={42} cy={126} />
      {/* steam */}
      <path d="M64 28c0 8 6 8 6 16M80 22c0 10 7 10 7 18M96 30c0 7 5 7 5 14" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      {/* bowl body */}
      <path
        d="M34 72c3.5 34 22 46 46 46s42.5-12 46-46H34Z"
        fill="#3B82F6"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M42 92c8 14 22 20 38 20" stroke="#60A5FA" strokeWidth="4" strokeLinecap="round" opacity="0.65" />
      {/* rim */}
      <ellipse cx="80" cy="72" rx="50" ry="16" fill="#60A5FA" stroke={INK} strokeWidth="3" />
      <ellipse cx="80" cy="70" rx="40" ry="10" fill="#93C5FD" opacity="0.55" />
      {/* noodles */}
      <path
        d="M54 62c8-16 20-22 30-6 7-12 20-8 26 6"
        stroke="#FFD43B"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* veggies */}
      <circle cx="62" cy="74" r="7" fill="#EF5B4A" stroke={INK} strokeWidth="2" />
      <circle cx="64" cy="72" r="2.2" fill="#FFF" opacity="0.45" />
      <circle cx="98" cy="70" r="6.5" fill="#22C55E" stroke={INK} strokeWidth="2" />
      <circle cx="100" cy="68" r="2" fill="#FFF" opacity="0.4" />
      <circle cx="80" cy="80" r="5.5" fill="#FF8A3D" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

export function IlloCart({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <SoftShadow rx={40} />
      <path d="M30 38h16l7 10" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M50 50h76l-9 40H58L50 50Z"
        fill="#FFD43B"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M58 58h52" stroke="#FFF8D6" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      {/* groceries */}
      <circle cx="74" cy="68" r="11" fill="#EF5B4A" stroke={INK} strokeWidth="2.5" />
      <circle cx="76" cy="65" r="3" fill="#FFF" opacity="0.4" />
      <ellipse cx="102" cy="72" rx="13" ry="10" fill="#22C55E" stroke={INK} strokeWidth="2.5" />
      <path d="M102 62v-6M98 58h8" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
      <rect
        x="86"
        y="58"
        width="11"
        height="18"
        rx="3.5"
        fill="#FF8A3D"
        stroke={INK}
        strokeWidth="2.5"
        transform="rotate(16 91.5 67)"
      />
      {/* wheels */}
      <circle cx="68" cy="108" r="11" fill="#FF8A3D" stroke={INK} strokeWidth="3.5" />
      <circle cx="68" cy="108" r="4" fill="#FFF8EF" />
      <circle cx="108" cy="108" r="11" fill="#FF8A3D" stroke={INK} strokeWidth="3.5" />
      <circle cx="108" cy="108" r="4" fill="#FFF8EF" />
    </svg>
  );
}

export function IlloCalendar({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <SoftShadow rx={40} />
      <rect x="36" y="36" width="88" height="78" rx="16" fill="#FFF" stroke={INK} strokeWidth="3.5" />
      <path d="M36 52h88" stroke={INK} strokeWidth="3.5" />
      <rect x="36" y="36" width="88" height="24" rx="16" fill="#3B82F6" />
      <path d="M36 48h88v12H36z" fill="#3B82F6" />
      <path d="M48 42h20" stroke="#BFDBFE" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      {/* rings */}
      <rect x="52" y="24" width="8" height="22" rx="4" fill="#FF8A3D" stroke={INK} strokeWidth="2.5" />
      <rect x="100" y="24" width="8" height="22" rx="4" fill="#FF8A3D" stroke={INK} strokeWidth="2.5" />
      {/* days */}
      <circle cx="56" cy="74" r="7" fill="#FFD43B" stroke={INK} strokeWidth="2" />
      <circle cx="80" cy="74" r="7" fill="#FF8A3D" stroke={INK} strokeWidth="2" />
      <circle cx="104" cy="74" r="7" fill="#22C55E" stroke={INK} strokeWidth="2" />
      <circle cx="56" cy="98" r="7" fill="#EF5B4A" stroke={INK} strokeWidth="2" />
      <circle cx="80" cy="98" r="7" fill="#60A5FA" stroke={INK} strokeWidth="2" />
      <rect x="96" y="91" width="16" height="14" rx="4" fill="#FFD43B" stroke={INK} strokeWidth="2" />
      <circle cx="58" cy="72" r="2" fill="#FFF" opacity="0.5" />
    </svg>
  );
}

export function IlloChef({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <SoftShadow rx={40} />
      {/* hat puffs */}
      <circle cx="56" cy="50" r="17" fill="#FFF" stroke={INK} strokeWidth="3.5" />
      <circle cx="104" cy="50" r="17" fill="#FFF" stroke={INK} strokeWidth="3.5" />
      <ellipse cx="80" cy="48" rx="34" ry="26" fill="#FFF" stroke={INK} strokeWidth="3.5" />
      <circle cx="80" cy="30" r="15" fill="#FFF" stroke={INK} strokeWidth="3.5" />
      <path d="M58 40c8-8 20-10 36-2" stroke="#F1F5F9" strokeWidth="4" strokeLinecap="round" />
      {/* band */}
      <rect x="52" y="64" width="56" height="16" rx="7" fill="#FFD43B" stroke={INK} strokeWidth="3.5" />
      <path d="M60 70h28" stroke="#FFF8D6" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
      {/* coat */}
      <path
        d="M58 80h44c4 0 8 4 8 10v18c0 8-8 14-22 14H72c-14 0-22-6-22-14V90c0-6 4-10 8-10Z"
        fill="#3B82F6"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <circle cx="80" cy="98" r="8" fill="#FF8A3D" stroke={INK} strokeWidth="2.5" />
      <circle cx="82" cy="95" r="2.5" fill="#FFF" opacity="0.45" />
    </svg>
  );
}

export function DecorDots({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 120 40" fill="none" aria-hidden>
      <circle cx="10" cy="20" r="3" fill="currentColor" />
      <circle cx="28" cy="12" r="2" fill="currentColor" />
      <circle cx="46" cy="24" r="2.5" fill="currentColor" />
      <path
        d="M62 10c8 4 10 14 20 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="98" cy="18" r="3" fill="currentColor" />
      <circle cx="112" cy="28" r="2" fill="currentColor" />
    </svg>
  );
}
