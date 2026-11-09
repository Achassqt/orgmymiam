import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const ActionMenuCloseContext = createContext<(() => void) | null>(null);

interface ActionMenuProps {
  label: string;
  children: ReactNode;
  align?: 'start' | 'end';
}

export function ActionMenu({ label, children, align = 'end' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={`action-menu align-${align}`} ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>⋯</span>
      </button>
      {open ? (
        <ActionMenuCloseContext.Provider value={() => setOpen(false)}>
          <div
            id={menuId}
            className="action-menu-panel"
            role="menu"
            aria-label={label}
          >
            {children}
          </div>
        </ActionMenuCloseContext.Provider>
      ) : null}
    </div>
  );
}

interface ActionMenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export function ActionMenuItem({
  children,
  onSelect,
  disabled,
  danger,
}: ActionMenuItemProps) {
  const close = useContext(ActionMenuCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? 'action-menu-item danger' : 'action-menu-item'}
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        close?.();
      }}
    >
      {children}
    </button>
  );
}
