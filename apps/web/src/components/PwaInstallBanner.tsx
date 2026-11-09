import { usePwaInstall } from '../hooks/usePwaInstall';

export function PwaInstallBanner() {
  const { showBanner, iosTip, canPrompt, busy, install, dismiss } = usePwaInstall();

  if (!showBanner) return null;

  return (
    <div className="pwa-banner" role="region" aria-label="Installer l’application">
      <div className="pwa-banner-copy">
        <strong>Ajouter à l’écran d’accueil</strong>
        {iosTip ? (
          <span className="meta">Sur Safari : Partager → « Sur l’écran d’accueil »</span>
        ) : (
          <span className="meta">Accès rapide, même hors ligne</span>
        )}
      </div>
      <div className="pwa-banner-actions">
        {canPrompt ? (
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
