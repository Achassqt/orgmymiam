import { useEffect, useState } from 'react';
import { getMeta, META_KEYS, setMeta } from '../db/database';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notCriOS = !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return iOS && webkit && notCriOS && !isStandalone();
}

export function PwaInstallBanner() {
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

  async function dismiss() {
    await setMeta(META_KEYS.pwaInstallDismissed, true);
    setDismissed(true);
  }

  async function install() {
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
  }

  if (dismissed) return null;
  if (!deferred && !iosTip) return null;

  return (
    <div className="pwa-banner" role="region" aria-label="Installer l’application">
      <div className="pwa-banner-copy">
        <strong>Ajouter à l’écran d’accueil</strong>
        {iosTip ? (
          <span className="meta">
            Sur Safari : Partager → « Sur l’écran d’accueil »
          </span>
        ) : (
          <span className="meta">Accès rapide, même hors ligne</span>
        )}
      </div>
      <div className="pwa-banner-actions">
        {deferred ? (
          <button
            type="button"
            className="primary-btn pwa-install-btn"
            disabled={busy}
            onClick={() => void install()}
          >
            Ajouter
          </button>
        ) : null}
        <button type="button" className="ghost-btn" onClick={() => void dismiss()}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
