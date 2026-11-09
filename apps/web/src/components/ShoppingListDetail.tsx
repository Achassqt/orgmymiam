import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import {
  addExtraItemToList,
  createProduct,
  removeShoppingItem,
  softDeleteShoppingList,
  toggleShoppingItem,
  updateShoppingItemFields,
  updateShoppingList,
} from '../data/crud';
import { getCachedHousehold } from '../data/household';
import type { ProductHit } from '../data/productSearch';
import {
  buildExtraItemFromHit,
  groupItemsByCategory,
  regenerateMealItems,
} from '../data/shoppingList';
import { db } from '../db/database';
import { useHousehold } from '../hooks/useHousehold';
import { initialsFromName } from '../lib/initials';
import { formatQuantity } from '../lib/units';
import { runSync } from '../sync/engine';
import { ProductSearchBox } from './ProductSearchBox';
import { UnitSelect } from './UnitSelect';
import { HouseholdBadge, VisibilityToggle } from './VisibilityToggle';

interface ShoppingListDetailProps {
  listId: string;
  onBack: () => void;
}

type PendingDraft =
  | { kind: 'hit'; hit: ProductHit; quantity: string; unit: string }
  | { kind: 'create'; name: string; quantity: string; unit: string };

export function ShoppingListDetail({ listId, onBack }: ShoppingListDetailProps) {
  const { session } = useAuth();
  const { members } = useHousehold();
  const userId = session?.user._id;
  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m._id, m])),
    [members],
  );
  const list = useLiveQuery(async () => {
    const row = await db.shoppingLists.get(listId);
    if (!row || row.deletedAt) return undefined;
    if (!userId) return row;
    if (row.userId === userId) return row;
    const household = await getCachedHousehold();
    if (
      row.visibility === 'household' &&
      household?.household &&
      row.householdId === household.household._id
    ) {
      return row;
    }
    return undefined;
  }, [listId, userId]);
  const planInfo = useLiveQuery(async () => {
    if (!list?.mealPlanId) return null;
    const plan = await db.mealPlans.get(list.mealPlanId);
    if (!plan || plan.deletedAt) return null;
    const servings = plan.slots
      .map((slot) => slot.servingsOverride)
      .filter((n): n is number => n != null && n > 0);
    const unique = [...new Set(servings)];
    return {
      title: plan.title,
      mealCount: plan.slots.length,
      portionsHint:
        unique.length === 1
          ? `Quantités pour ${unique[0]} personne${unique[0] === 1 ? '' : 's'} (selon le planning)`
          : 'Quantités selon les portions de chaque repas du planning',
    };
  }, [list?.mealPlanId, userId]);

  const [pending, setPending] = useState<PendingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showChecked, setShowChecked] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('unité');

  // Polling sync 8s tant que le détail liste est ouvert
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void runSync('shopping-poll');
      }
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [listId]);

  const groups = useMemo(() => {
    if (!list) return [];
    const items = showChecked ? list.items : list.items.filter((i) => !i.checked);
    return groupItemsByCategory(items);
  }, [list, showChecked]);

  const progress = useMemo(() => {
    if (!list || list.items.length === 0) return { done: 0, total: 0 };
    const done = list.items.filter((i) => i.checked).length;
    return { done, total: list.items.length };
  }, [list]);

  if (list === undefined) {
    return <p className="empty">Chargement…</p>;
  }
  if (!list || list.deletedAt) {
    return (
      <div>
        <p className="empty">Liste introuvable.</p>
        <button type="button" className="ghost-btn" onClick={onBack}>
          Retour
        </button>
      </div>
    );
  }

  async function onToggle(itemId: string) {
    setBusy(true);
    try {
      await toggleShoppingItem(listId, itemId);
    } finally {
      setBusy(false);
    }
  }

  function pickHit(hit: ProductHit) {
    setFeedback(null);
    setPending({
      kind: 'hit',
      hit,
      quantity: '1',
      unit: hit.defaultUnit || 'unité',
    });
  }

  function pickCreate(name: string) {
    setFeedback(null);
    setPending({
      kind: 'create',
      name,
      quantity: '1',
      unit: 'unité',
    });
  }

  async function confirmPending() {
    if (!pending) return;
    const qty = Number(pending.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFeedback('Quantité invalide');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      let hit: ProductHit;
      if (pending.kind === 'hit') {
        hit = pending.hit;
      } else {
        const created = await createProduct({ name: pending.name, defaultUnit: pending.unit });
        hit = {
          id: `user:${created.product._id}`,
          name: created.product.name,
          nameNormalized: created.product.nameNormalized,
          category: created.product.category,
          defaultUnit: created.product.defaultUnit,
          source: 'user',
          userProductId: created.product._id,
        };
      }

      const item = await buildExtraItemFromHit(hit, qty, pending.unit);
      const current = await db.shoppingLists.get(listId);
      const otherUnit = current?.items.find(
        (row) =>
          row.origin === 'extra' &&
          row.productId === item.productId &&
          row.productSource === item.productSource &&
          row.unit !== item.unit,
      );
      if (otherUnit) {
        setFeedback(
          `« ${hit.name} » est déjà sur la liste (${formatQuantity(otherUnit.quantity, otherUnit.unit)}). Harmonise l’unité ou modifie la ligne.`,
        );
        return;
      }

      const before = current?.items.find(
        (row) =>
          row.origin === 'extra' &&
          row.productId === item.productId &&
          row.productSource === item.productSource &&
          row.unit === item.unit,
      );
      await addExtraItemToList(listId, item);
      setFeedback(
        before ? `Quantité de « ${hit.name} » augmentée.` : `Ajouté : ${hit.name}`,
      );
      setPending(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onRegenerate() {
    setBusy(true);
    setFeedback(null);
    try {
      await regenerateMealItems(listId);
      setFeedback('Articles du planning mis à jour (ajouts manuels conservés).');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onCloseList() {
    const current = await db.shoppingLists.get(listId);
    if (!current) return;
    await updateShoppingList(listId, {
      status: current.status === 'open' ? 'closed' : 'open',
    });
  }

  function startEdit(itemId: string, quantity: number, unit: string) {
    setEditingId(itemId);
    setEditQty(String(quantity));
    setEditUnit(unit);
  }

  async function saveEdit(itemId: string) {
    const qty = Number(editQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFeedback('Quantité invalide');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await updateShoppingItemFields(listId, itemId, { quantity: qty, unit: editUnit });
      setEditingId(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Modification impossible');
    } finally {
      setBusy(false);
    }
  }

  const pendingName = pending
    ? pending.kind === 'hit'
      ? pending.hit.name
      : pending.name
    : '';

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <button type="button" className="ghost-btn" onClick={onBack}>
          ← Listes
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => void softDeleteShoppingList(listId).then(onBack)}
        >
          Suppr.
        </button>
      </div>

      <h1>
        {list.title} <HouseholdBadge visibility={list.visibility} />
      </h1>
      {list.visibility === 'household' ? (
        <p className="meta members-hint">
          {list.memberIds.length} membre{list.memberIds.length === 1 ? '' : 's'} · sync auto
        </p>
      ) : null}
      <VisibilityToggle
        entity="shopping_lists"
        id={list._id}
        value={list.visibility ?? 'private'}
      />
      <p className="lede">
        {list.status === 'open' ? 'Ouverte' : 'Terminée'}
        {planInfo ? ` · planning « ${planInfo.title} »` : ' · sans planning'}
        {' · '}
        {progress.done}/{progress.total} cochés
      </p>
      {planInfo ? (
        <p className="portions-banner" role="status">
          {planInfo.portionsHint}
          {planInfo.mealCount > 0 ? ` · ${planInfo.mealCount} repas` : ''}
        </p>
      ) : null}

      <div className="editor-actions wrap">
        <button type="button" className="ghost-btn" onClick={() => setShowChecked((v) => !v)}>
          {showChecked ? 'Masquer cochés' : 'Afficher cochés'}
        </button>
        {list.mealPlanId ? (
          <button type="button" className="ghost-btn" disabled={busy} onClick={() => void onRegenerate()}>
            Mettre à jour depuis le planning
          </button>
        ) : null}
        <button type="button" className="ghost-btn" onClick={() => void onCloseList()}>
          {list.status === 'open' ? 'Marquer terminée' : 'Rouvrir'}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">Liste vide</p>
          <p className="empty-state-desc">
            Ajoute un produit ci-dessous, ou reviens générer depuis un planning.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="category-block">
            <h2 className="category-title">{group.label}</h2>
            <ul className="shop-list">
              {group.items.map((item) => (
                <li key={item.id} className={item.checked ? 'shop-item checked' : 'shop-item'}>
                  <label className="shop-check">
                    <input
                      className="shop-check-input"
                      type="checkbox"
                      checked={item.checked}
                      disabled={busy}
                      onChange={() => void onToggle(item.id)}
                    />
                    <span className="shop-check-box" aria-hidden />
                    <span className="shop-check-body">
                      <strong>{item.nameSnapshot}</strong>
                      <span className="meta">
                        {formatQuantity(item.quantity, item.unit)}
                        {item.origin === 'extra' ? ' · ajouté' : ''}
                      </span>
                      {item.checked && item.updatedBy && memberById[item.updatedBy] ? (
                        <span
                          className="checked-by-chip"
                          title={`Coché par ${memberById[item.updatedBy]!.displayName}`}
                        >
                          {initialsFromName(memberById[item.updatedBy]!.displayName)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <div className="shop-item-actions">
                    {editingId === item.id ? (
                      <span className="qty-edit">
                        <input
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          inputMode="decimal"
                          aria-label={`Quantité pour ${item.nameSnapshot}`}
                          disabled={busy}
                        />
                        <UnitSelect value={editUnit} onChange={setEditUnit} disabled={busy} />
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={busy}
                          onClick={() => void saveEdit(item.id)}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setEditingId(null)}
                        >
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={busy}
                        onClick={() => startEdit(item.id, item.quantity, item.unit)}
                      >
                        Qté
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => void removeShoppingItem(listId, item.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="ingredient-adder">
        <h3 className="subhead">Ajouter un produit</h3>
        {pending ? (
          <div className="draft-panel stack-form">
            <p className="draft-product">
              <strong>{pendingName}</strong>
              {pending.kind === 'hit' ? (
                <span className="meta">Unité suggérée : {pending.hit.defaultUnit}</span>
              ) : (
                <span className="meta">Nouveau produit</span>
              )}
            </p>
            <div className="qty-row">
              <label>
                Quantité
                <input
                  value={pending.quantity}
                  onChange={(e) => setPending({ ...pending, quantity: e.target.value })}
                  inputMode="decimal"
                />
              </label>
              <label>
                Unité
                <UnitSelect
                  value={pending.unit}
                  onChange={(unit) => setPending({ ...pending, unit })}
                />
              </label>
            </div>
            <div className="editor-actions wrap">
              <button
                type="button"
                className="primary-btn"
                disabled={busy}
                onClick={() => void confirmPending()}
              >
                Ajouter
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="field-help">Choisis un produit, puis confirme quantité et unité.</p>
            <ProductSearchBox
              busy={busy}
              compact
              placeholder="Ex. éponge, snacks…"
              addLabel="Choisir"
              reuseLabel="Choisir"
              onCreate={(name) => pickCreate(name)}
              onSelect={(hit) => pickHit(hit)}
            />
          </>
        )}
      </div>

      {feedback ? <p className="search-notice">{feedback}</p> : null}
    </div>
  );
}
