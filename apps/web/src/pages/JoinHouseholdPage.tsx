import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DishIlloFrame } from '../components/DishIllos';
import { useHousehold } from '../hooks/useHousehold';

export function JoinHouseholdPage() {
  const { session } = useAuth();
  const { join, isMember, loading } = useHousehold();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => (params.get('code') ?? '').toUpperCase());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = (params.get('code') ?? '').toUpperCase();
    if (fromUrl) setCode(fromUrl);
  }, [params]);

  useEffect(() => {
    if (isMember) {
      navigate('/foyer', { replace: true });
    }
  }, [isMember, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await join(code.trim().toUpperCase());
      navigate('/foyer', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de rejoindre');
    }
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <div className="auth-card soft-card">
          <div className="auth-hero panel-sage">
            <div className="auth-hero-illo float-soft" aria-hidden>
              <DishIlloFrame dish="soupe" size="lg" />
            </div>
            <p className="brand">OrgMyMiam</p>
            <p className="auth-tagline">Rejoins le foyer familial.</p>
          </div>
          <h1>Rejoindre un foyer</h1>
          <p className="lede">Connecte-toi pour utiliser le code d’invitation.</p>
          {code ? (
            <p className="meta auth-code-hint">
              Code : <strong className="invite-code">{code}</strong>
            </p>
          ) : null}
          <div className="quick-links">
            <Link to={`/login?next=${encodeURIComponent(`/rejoindre?code=${code}`)}`}>
              Connexion
            </Link>
            <Link to={`/register?next=${encodeURIComponent(`/rejoindre?code=${code}`)}`}>
              Créer un compte
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card soft-card">
        <div className="auth-hero panel-sand">
          <div className="auth-hero-illo float-soft" aria-hidden>
            <DishIlloFrame dish="soupe" size="lg" />
          </div>
          <p className="brand">OrgMyMiam</p>
          <p className="auth-tagline">Un code, et tu es dans le foyer.</p>
        </div>
        <h1>Rejoindre un foyer</h1>
        <p className="lede">Entre le code à 6 caractères reçu par un membre.</p>
        <form className="stack-form" onSubmit={(e) => void onSubmit(e)}>
          <label>
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              minLength={6}
              autoCapitalize="characters"
              required
            />
          </label>
          <button
            type="submit"
            className="primary-btn"
            disabled={loading || code.trim().length !== 6}
          >
            Rejoindre
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </form>
        <p className="auth-switch">
          <Link to="/foyer">Gérer mon foyer</Link>
        </p>
      </div>
    </div>
  );
}
