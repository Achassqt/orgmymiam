import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getMeta, META_KEYS, setMeta } from '../db/database';
import { DishIlloFrame } from './DishIllos';

type DoneMap = Record<string, true>;

export const ONBOARDING_REPLAY_EVENT = 'omm:replay-onboarding';

const STEPS = [
  {
    title: 'Crée tes recettes',
    body: 'Ajoute tes plats du quotidien avec portions et ingrédients.',
    dish: 'poulet' as const,
  },
  {
    title: 'Organise ta semaine',
    body: 'Place tes recettes dans le planning, jour par jour.',
    dish: 'carbonara' as const,
  },
  {
    title: 'Génère tes courses',
    body: 'La liste se construit à partir de ton planning.',
    dish: 'salade' as const,
  },
  {
    title: 'Consulte ton planning',
    body: 'Retrouve le prochain repas et suis ta semaine.',
    dish: 'soupe' as const,
  },
] as const;

async function markDone(userId: string): Promise<void> {
  const existing = (await getMeta<DoneMap>(META_KEYS.onboardingDoneBy)) ?? {};
  await setMeta(META_KEYS.onboardingDoneBy, { ...existing, [userId]: true });
}

/** Efface le flag « déjà vu » pour relancer le guide depuis le menu. */
export async function resetOnboardingDone(userId: string): Promise<void> {
  const existing = (await getMeta<DoneMap>(META_KEYS.onboardingDoneBy)) ?? {};
  if (!existing[userId]) return;
  const next = { ...existing };
  delete next[userId];
  await setMeta(META_KEYS.onboardingDoneBy, next);
}

export function requestOnboardingReplay(): void {
  window.dispatchEvent(new Event(ONBOARDING_REPLAY_EVENT));
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

  useEffect(() => {
    if (!userId) return;
    function onReplay() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener(ONBOARDING_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(ONBOARDING_REPLAY_EVENT, onReplay);
  }, [userId]);

  async function finish() {
    if (!userId) return;
    await markDone(userId);
    setOpen(false);
  }

  function goNext() {
    if (step >= STEPS.length - 1) {
      void finish();
      return;
    }
    setStep((s) => s + 1);
  }

  if (!ready || !open || !userId) return null;

  const current = STEPS[step]!;

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
          <button type="button" className="primary-btn" onClick={goNext}>
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
