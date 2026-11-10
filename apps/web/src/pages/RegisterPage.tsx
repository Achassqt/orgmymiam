import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../api/client';
import { DishIlloFrame } from '../components/DishIllos';

export function RegisterPage() {
  const { session, register, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to={next.startsWith('/') ? next : '/'} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      navigate(next.startsWith('/') ? next : '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inscription impossible');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card soft-card">
        <div className="auth-hero panel-sand">
          <div className="auth-hero-illo float-soft" aria-hidden>
            <DishIlloFrame dish="salade" size="lg" />
          </div>
          <p className="brand">OrgMyMiam</p>
          <p className="auth-tagline">Ton assistant repas du quotidien.</p>
        </div>
        <h1>Créer un compte</h1>
        <form onSubmit={(e) => void onSubmit(e)} className="stack-form">
          <label>
            Prénom / pseudo
            <input
              type="text"
              required
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? 'Création…' : 'S’inscrire'}
          </button>
        </form>
        <p className="auth-switch">
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
