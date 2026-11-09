import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMeta, META_KEYS, setMeta } from '../db/database';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaInstallValue {
  dismissed: boolean;
  iosTip: boolean;
  busy: boolean;
  canPrompt: boolean;
  showBanner: boolean;
  install: () => Promise<void>;
  dismiss: () => Promise<void>;
}

const PwaInstallContext = createContext<PwaInstallValue | null>(null);

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const ios =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notCriOS = !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return iOS && webkit && notCriOS && !isStandalone();
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(true);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosTip, setIosTip] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const flag = await getMeta<boolean>(META_KEYS.pwaInstallDismissed);
      if (cancelled) return;
      if (flag || isStandalone()) {
        setDismissed(true);
        return;
      }
      setDismissed(false);
      setIosTip(isIosSafari());
    })();

    function onBip(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setIosTip(false);
    }
    window.addEventListener('beforeinstallprompt', onBip);
    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

  const dismiss = useCallback(async () => {
    await setMeta(META_KEYS.pwaInstallDismissed, true);
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      await dismiss();
    } finally {
      setBusy(false);
    }
  }, [deferred, dismiss]);

  const canPrompt = Boolean(deferred);
  const showBanner = !dismissed && (canPrompt || iosTip);

  const value = useMemo(
    () => ({
      dismissed,
      iosTip,
      busy,
      canPrompt,
      showBanner,
      install,
      dismiss,
    }),
    [dismissed, iosTip, busy, canPrompt, showBanner, install, dismiss],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall(): PwaInstallValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }
  return ctx;
}
