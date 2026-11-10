/** Icône suppression — poubelle claire (pas une croix). Tap target géré par .icon-btn. */
export function TrashIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M9.5 3a1 1 0 0 0-.9.55L8.2 4.5H5a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2h-3.2l-.4-.95A1 1 0 0 0 14.5 3h-5Zm-2.3 5.5a1 1 0 0 1 1 1.05l.4 9.1a1.5 1.5 0 0 0 1.5 1.45h4.8a1.5 1.5 0 0 0 1.5-1.45l.4-9.1a1 1 0 1 1 2 .09l-.4 9.1A3.5 3.5 0 0 1 14.9 22h-4.8a3.5 3.5 0 0 1-3.5-3.26l-.4-9.1a1 1 0 0 1 1-.14ZM10 10a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}
