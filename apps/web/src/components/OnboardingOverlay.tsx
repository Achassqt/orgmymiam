import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getMeta, META_KEYS, setMeta } from '../db/database';
import { DishIlloFrame } from './DishIllos';

type DoneMap = Record<string, true>;

const STEPS = [
  {
    title: 'Crée une recette',
    body: 'Ajoute tes plats du quotidien, on s’occupe des quantités.',
    cta: 'Voir les recettes',
    to: '/recettes',
    dish: 'poulet' as const,
  },
  {
    title: 'Génère ta liste',
    body: 'Planifie tes repas, puis lance ta liste de courses en un tap.',
    cta: 'Voir le planning',
    to: '/plans',
    dish: 'salade' as const,
  },
] as const;

async function markDone(userId: string): Promise<void> {
  const existing = (await getMeta<DoneMap>(META_KEYS.onboardingDoneBy)) ?? {};
  await setMeta(META_KEYS.onboardingDoneBy, { ...existing, [userId]: true });
}

export function OnboardingOverlay() {
  const { session } = useAuth();
  const userId = session?.user._id;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      setOpen(false);
      setReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const done = (await getMeta<DoneMap>(META_KEYS.onboardingDoneBy)) ?? {};
      if (cancelled) return;
      setOpen(!done[userId]);
      setStep(0);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function finish() {
    if (!userId) return;
    await markDone(userId);
    setOpen(false);
  }

  if (!ready || !open || !userId) return null;

  const current = STEPS[step]!;
  const isLast = step >= STEPS.length - 1;

  return (
    <div
      className="onboarding-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-card page-enter">
        <button type="button" className="onboarding-skip" onClick={() => void finish()}>
          Passer
        </button>
        <div className="onboarding-illo float-soft" aria-hidden>
          <DishIlloFrame dish={current.dish} size="lg" />
        </div>
        <p className="onboarding-step">
          {step + 1}/{STEPS.length}
        </p>
        <h2 id="onboarding-title">{current.title}</h2>
        <p className="lede">{current.body}</p>
        <div className="onboarding-actions">
          {isLast ? (
            <Link className="primary-btn" to={current.to} onClick={() => void finish()}>
              {current.cta}
            </Link>
          ) : (
            <button type="button" className="primary-btn" onClick={() => setStep((s) => s + 1)}>
              Suivant
            </button>
          )}
          {!isLast ? (
            <Link className="ghost-btn" to={current.to} onClick={() => void finish()}>
              {current.cta}
            </Link>
          ) : (
            <button type="button" className="ghost-btn" onClick={() => void finish()}>
              C’est parti
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
