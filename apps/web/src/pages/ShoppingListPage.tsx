import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState } from '../components/EmptyState';
import { TrashIcon } from '../components/icons';
import { PullToRefresh } from '../components/PullToRefresh';
import { ShoppingListDetail } from '../components/ShoppingListDetail';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { createShoppingList, softDeleteShoppingList } from '../data/crud';
import { generateShoppingListFromDateRange } from '../data/shoppingList';
import { db } from '../db/database';
import { addDaysIso } from '../lib/homeHub';
import { todayIsoDate } from '../lib/planDates';
import { sanitizeUiEmDash } from '../lib/shoppingListShare';

function defaultRange(): { from: string; to: string } {
  const from = todayIsoDate();
  return { from, to: addDaysIso(from, 14) };
}

export function ShoppingListPage() {
  const { session } = useAuth();
  const userId = session?.user._id;
  const lists =
    useLiveQuery(
      () =>
        userId
          ? db.shoppingLists
              .filter((l) => l.deletedAt == null)
              .reverse()
              .sortBy('updatedAt')
          : [],
      [userId],
    ) ?? [];
  const plans =
    useLiveQuery(
      () =>
        userId
          ? db.mealPlans
              .filter((p) => p.deletedAt == null)
              .reverse()
              .sortBy('updatedAt')
          : [],
      [userId],
    ) ?? [];

  const initialRange = useMemo(() => defaultRange(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState(initialRange.from);
  const [rangeTo, setRangeTo] = useState(initialRange.to);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selectedId) {
    return (
      <section className="page-section page-enter">
        <ShoppingListDetail listId={selectedId} onBack={() => setSelectedId(null)} />
      </section>
    );
  }

  async function onGenerate() {
    if (!rangeFrom || !rangeTo) {
      setError('Choisis une plage de dates');
      return;
    }
    if (rangeFrom > rangeTo) {
      setError('La date de début doit précéder la date de fin');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const list = await generateShoppingListFromDateRange({
        rangeFrom,
        rangeTo,
        notes: notes.trim() || undefined,
      });
      setNotes('');
      setSelectedId(list._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Génération impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateEmpty() {
    setBusy(true);
    setError(null);
    try {
      const list = await createShoppingList({
        title: 'Courses',
        notes: notes.trim() || undefined,
      });
      setNotes('');
      setSelectedId(list._id);
    } finally {
      setBusy(false);
    }
  }

  const showEmptyHub = lists.length === 0 && plans.length === 0;

  return (
    <PullToRefresh>
      <section className="page-section page-enter screen-courses">
        <div className="page-heading">
          <div>
            <h1 className="screen-title">Courses</h1>
            <p className="lede">Génère depuis le planning, coche au fur et à mesure.</p>
          </div>
        </div>

        {showEmptyHub ? (
          <EmptyState
            illo="cart"
            title="Pas encore de liste"
            description="Crée d’abord un planning avec des recettes, puis reviens générer tes courses."
            action={
              <Link className="primary-btn" to="/plans">
                Aller au planning
              </Link>
            }
          />
        ) : (
          <div className="stack-form generate-box soft-card">
            <h2 className="subhead generate-box-title">Nouvelle liste</h2>
            <div className="date-range-row">
              <label>
                Du
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Au
                <input
                  type="date"
                  value={rangeTo}
                  min={rangeFrom}
                  onChange={(e) => setRangeTo(e.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
            <label>
              Note (facultatif)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex. courses du week-end, budget serré…"
                rows={2}
                disabled={busy}
              />
            </label>
            <div className="editor-actions wrap">
              <button
                type="button"
                className="primary-btn"
                disabled={busy || !rangeFrom || !rangeTo}
                onClick={() => void onGenerate()}
              >
                Générer la liste
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={() => void onCreateEmpty()}
              >
                Liste vide
              </button>
            </div>
            {plans.length === 0 ? (
              <p className="empty">
                Crée d’abord un <Link to="/plans">planning</Link> pour générer une liste.
              </p>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
          </div>
        )}

        {lists.length > 0 ? (
          <>
            <h2 className="subhead">Mes listes</h2>
            <ul className="entity-list shop-hub-list">
              {lists.map((list) => {
                const checked = list.items.filter((i) => i.checked).length;
                const total = list.items.length;
                const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
                return (
                  <li key={list._id} className="shop-hub-card">
                    <button
                      type="button"
                      className="entity-main-btn shop-list-card-btn"
                      onClick={() => setSelectedId(list._id)}
                    >
                      <span className="shop-hub-icon" aria-hidden>
                        <ShopBasketIcon />
                      </span>
                      <span className="shop-hub-body">
                        <strong className="shop-hub-title">
                          {sanitizeUiEmDash(list.title)}{' '}
                          <HouseholdBadge visibility={list.visibility} />
                        </strong>
                        <span className="meta">
                          {list.status === 'open' ? 'Ouverte' : 'Terminée'}
                          {list.visibility === 'household'
                            ? ` · ${list.memberIds.length} membre${list.memberIds.length === 1 ? '' : 's'}`
                            : ''}
                        </span>
                        {list.notes ? (
                          <span className="shop-hub-note meta">{list.notes}</span>
                        ) : null}
                        <span className="shop-hub-progress" aria-hidden>
                          <span className="shop-hub-progress-bar" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="shop-hub-fraction">
                          <span className="shop-hub-fraction-num">
                            {checked}/{total}
                          </span>{' '}
                          cochés
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn soft"
                      aria-label={`Supprimer ${sanitizeUiEmDash(list.title)}`}
                      title="Supprimer"
                      onClick={() => {
                        if (!window.confirm(`Supprimer « ${sanitizeUiEmDash(list.title)} » ?`))
                          return;
                        void softDeleteShoppingList(list._id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </section>
    </PullToRefresh>
  );
}

function ShopBasketIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 10h17l-1.6 8.6a2 2 0 0 1-2 1.6H7.1a2 2 0 0 1-2-1.6z"
        stroke="#1F3D2B"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 10l4-6 4 6M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5"
        stroke="#1F3D2B"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
