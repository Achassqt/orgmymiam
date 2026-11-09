type IlloProps = {
  className?: string;
};

/** Cartoon food SVGs — playful vector style, not photo-realistic. */

export function IlloBurger({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <ellipse cx="80" cy="128" rx="48" ry="8" fill="#1E1B4B" opacity="0.12" />
      <path
        d="M28 62c0-28 24-48 52-48s52 20 52 48H28Z"
        fill="#F4A261"
      />
      <path d="M28 62h104v10H28z" fill="#E76F51" />
      <path
        d="M32 72c8 10 20 14 48 14s40-4 48-14H32Z"
        fill="#2A9D8F"
      />
      <ellipse cx="80" cy="88" rx="50" ry="14" fill="#E9C46A" />
      <path d="M30 96c10 18 30 28 50 28s40-10 50-28H30Z" fill="#F4A261" />
      <circle cx="48" cy="42" r="3.5" fill="#E76F51" />
      <circle cx="72" cy="34" r="3" fill="#E76F51" />
      <circle cx="98" cy="40" r="3.5" fill="#E76F51" />
      <circle cx="112" cy="50" r="2.5" fill="#E76F51" />
    </svg>
  );
}

export function IlloBowl({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <ellipse cx="80" cy="126" rx="42" ry="7" fill="#1E1B4B" opacity="0.12" />
      <path d="M30 70c4 36 24 50 50 50s46-14 50-50H30Z" fill="#3B82F6" />
      <ellipse cx="80" cy="70" rx="50" ry="18" fill="#60A5FA" />
      <path
        d="M55 58c6-18 18-28 30-10 8-14 22-8 28 6"
        stroke="#FBBF24"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="62" cy="72" r="7" fill="#EF4444" />
      <circle cx="98" cy="68" r="6" fill="#22C55E" />
      <circle cx="80" cy="78" r="5" fill="#F97316" />
      <path d="M118 34l8 28M126 30l2 24" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IlloCart({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <ellipse cx="80" cy="128" rx="40" ry="7" fill="#1E1B4B" opacity="0.12" />
      <path d="M28 36h18l8 12" stroke="#1E1B4B" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M48 48h78l-10 42H58L48 48Z"
        fill="#FFD43B"
        stroke="#1E1B4B"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="68" cy="108" r="10" fill="#FF8A3D" stroke="#1E1B4B" strokeWidth="4" />
      <circle cx="108" cy="108" r="10" fill="#FF8A3D" stroke="#1E1B4B" strokeWidth="4" />
      <circle cx="78" cy="66" r="10" fill="#EF4444" />
      <ellipse cx="104" cy="70" rx="12" ry="9" fill="#22C55E" />
      <rect x="88" y="58" width="10" height="16" rx="3" fill="#F97316" transform="rotate(18 93 66)" />
    </svg>
  );
}

export function IlloCalendar({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <ellipse cx="80" cy="128" rx="40" ry="7" fill="#1E1B4B" opacity="0.12" />
      <rect x="34" y="34" width="92" height="80" rx="18" fill="#FFF" stroke="#1E1B4B" strokeWidth="4" />
      <rect x="34" y="34" width="92" height="26" rx="18" fill="#3B82F6" />
      <rect x="34" y="48" width="92" height="12" fill="#3B82F6" />
      <circle cx="56" cy="28" r="6" fill="#FF8A3D" stroke="#1E1B4B" strokeWidth="3" />
      <circle cx="104" cy="28" r="6" fill="#FF8A3D" stroke="#1E1B4B" strokeWidth="3" />
      <circle cx="56" cy="78" r="7" fill="#FFD43B" />
      <circle cx="80" cy="78" r="7" fill="#FF8A3D" />
      <circle cx="104" cy="78" r="7" fill="#22C55E" />
      <circle cx="56" cy="100" r="7" fill="#EF4444" />
      <circle cx="80" cy="100" r="7" fill="#A78BFA" />
      <rect x="96" y="94" width="16" height="14" rx="4" fill="#FFD43B" stroke="#1E1B4B" strokeWidth="2" />
    </svg>
  );
}

export function IlloChef({ className }: IlloProps) {
  return (
    <svg className={className} viewBox="0 0 160 140" fill="none" aria-hidden>
      <ellipse cx="80" cy="128" rx="40" ry="7" fill="#1E1B4B" opacity="0.12" />
      <ellipse cx="80" cy="48" rx="36" ry="28" fill="#FFF" stroke="#1E1B4B" strokeWidth="4" />
      <circle cx="58" cy="48" r="16" fill="#FFF" stroke="#1E1B4B" strokeWidth="4" />
      <circle cx="102" cy="48" r="16" fill="#FFF" stroke="#1E1B4B" strokeWidth="4" />
      <circle cx="80" cy="30" r="14" fill="#FFF" stroke="#1E1B4B" strokeWidth="4" />
      <rect x="50" y="62" width="60" height="18" rx="6" fill="#FFD43B" stroke="#1E1B4B" strokeWidth="4" />
      <rect x="58" y="80" width="44" height="36" rx="12" fill="#3B82F6" stroke="#1E1B4B" strokeWidth="4" />
      <circle cx="80" cy="98" r="8" fill="#FF8A3D" />
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
