import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { absoluteJoinUrl } from '../data/household';
import { useHousehold } from '../hooks/useHousehold';

export function HouseholdPage() {
  const { session } = useAuth();
  const { household, members, joinPath, loading, error, create, join, leave, rotate, isMember } =
    useHousehold();
  const [name, setName] = useState('Notre foyer');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isOwner = household?.ownerId === session?.user._id;

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    try {
      await create(name.trim() || 'Notre foyer');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Création impossible');
    }
  }

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    try {
      await join(code.trim().toUpperCase());
      setCode('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Code invalide');
    }
  }

  async function onCopyLink() {
    if (!joinPath) return;
    const url = absoluteJoinUrl(joinPath);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setLocalError('Impossible de copier le lien');
    }
  }

  if (isMember && household) {
    return (
      <section className="page-section">
        <div className="page-heading">
          <div>
            <h1>Foyer</h1>
            <p className="lede">Partage recettes, planning et courses avec ta famille.</p>
          </div>
          <Link to="/" className="ghost-btn">
            Accueil
          </Link>
        </div>

        <div className="household-card">
          <h2 className="subhead">{household.name}</h2>
          <p className="meta">
            {members.length} membre{members.length === 1 ? '' : 's'} · code{' '}
            <strong className="invite-code">{household.inviteCode}</strong>
          </p>
          <div className="editor-actions wrap">
            <button type="button" className="primary-btn" onClick={() => void onCopyLink()}>
              {copied ? 'Lien copié' : 'Copier le lien'}
            </button>
            {isOwner ? (
              <button
                type="button"
                className="ghost-btn"
                disabled={loading}
                onClick={() => void rotate()}
              >
                Nouveau code
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-btn danger-text"
              disabled={loading}
              onClick={() => void leave()}
            >
              Quitter le foyer
            </button>
          </div>
        </div>

        <h2 className="subhead">Membres</h2>
        <ul className="entity-list">
          {members.map((member) => (
            <li key={member._id}>
              <div className="entity-main-btn static">
                <strong>
                  {member.displayName}
                  {member._id === household.ownerId ? ' · propriétaire' : ''}
                  {member._id === session?.user._id ? ' · toi' : ''}
                </strong>
                <span className="meta">{member.email}</span>
              </div>
            </li>
          ))}
        </ul>
        {error || localError ? <p className="form-error">{localError ?? error}</p> : null}
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>Foyer</h1>
          <p className="lede">Crée un foyer ou rejoins-en un avec un code à 6 caractères.</p>
        </div>
      </div>

      <form className="stack-form generate-box" onSubmit={(e) => void onCreate(e)}>
        <h2 className="subhead">Créer un foyer</h2>
        <label>
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>
        <button type="submit" className="primary-btn" disabled={loading}>
          Créer
        </button>
      </form>

      <form className="stack-form generate-box" onSubmit={(e) => void onJoin(e)}>
        <h2 className="subhead">Rejoindre</h2>
        <label>
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            minLength={6}
            placeholder="ABC123"
            autoCapitalize="characters"
            required
          />
        </label>
        <button type="submit" className="primary-btn" disabled={loading || code.trim().length !== 6}>
          Rejoindre
        </button>
      </form>

      {error || localError ? <p className="form-error">{localError ?? error}</p> : null}
    </section>
  );
}
