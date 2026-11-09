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
import {
  formatPrintDate,
  formatShoppingListShareText,
} from '../lib/shoppingListShare';
import { formatQuantity } from '../lib/units';
import { runSync } from '../sync/engine';
import { ActionMenu, ActionMenuItem } from './ActionMenu';
import { ProductSearchBox } from './ProductSearchBox';
import { useToast } from './ToastHost';
import { UnitSelect } from './UnitSelect';
import { HouseholdBadge, VisibilityToggle } from './VisibilityToggle';

interface ShoppingListDetailProps {
  listId: string;
  onBack: () => void;
}

type PendingDraft =
  | { kind: 'hit'; hit: ProductHit; quantity: string; unit: string }
  | { kind: 'create'; name: string; quantity: string; unit: string };

type ItemFilter = 'active' | 'all';

export function ShoppingListDetail({ listId, onBack }: ShoppingListDetailProps) {
  const { session } = useAuth();
  const { members } = useHousehold();
  const showToast = useToast();
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
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');
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
    const items =
      itemFilter === 'all' ? list.items : list.items.filter((i) => !i.checked);
    return groupItemsByCategory(items);
  }, [list, itemFilter]);

  const printGroups = useMemo(() => {
    if (!list) return [];
    return groupItemsByCategory(list.items);
  }, [list]);

  const progress = useMemo(() => {
    if (!list || list.items.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = list.items.filter((i) => i.checked).length;
    const total = list.items.length;
    return { done, total, pct: Math.round((done / total) * 100) };
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

  async function onShare() {
    if (!list) return;
    const text = formatShoppingListShareText(list.title, list.items);
    const title = list.title;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Fallback presse-papiers si share échoue (hors annulation).
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Liste copiée dans le presse-papiers');
    } catch {
      showToast('Impossible de partager la liste');
    }
  }

  function onPrint() {
    window.print();
  }

  function onDeleteList() {
    if (!window.confirm('Supprimer cette liste de courses ?')) return;
    void softDeleteShoppingList(listId).then(onBack);
  }

  const pendingName = pending
    ? pending.kind === 'hit'
      ? pending.hit.name
      : pending.name
    : '';

  return (
    <div className="editor-panel shopping-list-detail">
      <div className="no-print">
        <div className="editor-header">
          <button type="button" className="back-link" onClick={onBack}>
            ← Retour
          </button>
          <ActionMenu label="Autres actions">
            <ActionMenuItem
              disabled={busy || list.items.length === 0}
              onSelect={() => void onShare()}
            >
              Partager
            </ActionMenuItem>
            <ActionMenuItem
              disabled={busy || list.items.length === 0}
              onSelect={onPrint}
            >
              Imprimer
            </ActionMenuItem>
            <ActionMenuItem onSelect={() => void onCloseList()}>
              {list.status === 'open' ? 'Marquer terminée' : 'Rouvrir'}
            </ActionMenuItem>
            {list.mealPlanId ? (
              <ActionMenuItem
                disabled={busy}
                onSelect={() => void onRegenerate()}
              >
                Mettre à jour depuis le planning
              </ActionMenuItem>
            ) : null}
            <ActionMenuItem danger onSelect={onDeleteList}>
              Supprimer
            </ActionMenuItem>
          </ActionMenu>
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
        <div className="list-status-row">
          <p className="lede list-status-lede">
            {list.status === 'open' ? 'Ouverte' : 'Terminée'}
            {planInfo ? ` · planning « ${planInfo.title} »` : ' · sans planning'}
          </p>
          <div
            className="progress-pill"
            role="status"
            aria-label={`${progress.done} sur ${progress.total} cochés`}
          >
            <span
              className="progress-pill-bar"
              style={{ width: `${progress.pct}%` }}
              aria-hidden
            />
            <span className="progress-pill-label">
              {progress.done}/{progress.total} cochés
            </span>
          </div>
        </div>
        {planInfo ? (
          <p className="portions-banner" role="status">
            {planInfo.portionsHint}
            {planInfo.mealCount > 0 ? ` · ${planInfo.mealCount} repas` : ''}
          </p>
        ) : null}

        <div
          className="segmented"
          role="group"
          aria-label="Filtrer les articles"
        >
          <button
            type="button"
            className={itemFilter === 'active' ? 'segmented-btn active' : 'segmented-btn'}
            aria-pressed={itemFilter === 'active'}
            onClick={() => setItemFilter('active')}
          >
            En cours
          </button>
          <button
            type="button"
            className={itemFilter === 'all' ? 'segmented-btn active' : 'segmented-btn'}
            aria-pressed={itemFilter === 'all'}
            onClick={() => setItemFilter('all')}
          >
            Tout
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">
              {itemFilter === 'active' && progress.total > 0
                ? 'Tout est coché'
                : 'Liste vide'}
            </p>
            <p className="empty-state-desc">
              {itemFilter === 'active' && progress.total > 0
                ? 'Passe sur « Tout » pour revoir les articles cochés.'
                : 'Ajoute un produit ci-dessous, ou reviens générer depuis un planning.'}
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
                          className="icon-btn soft"
                          disabled={busy}
                          aria-label={`Modifier la quantité de ${item.nameSnapshot}`}
                          title="Quantité"
                          onClick={() => startEdit(item.id, item.quantity, item.unit)}
                        >
                          <QtyIcon />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn soft"
                        aria-label={`Retirer ${item.nameSnapshot}`}
                        title="Retirer"
                        onClick={() => void removeShoppingItem(listId, item.id)}
                      >
                        <span aria-hidden>×</span>
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

      <div className="print-sheet" aria-hidden="true">
        <header className="print-sheet-header">
          <p className="print-brand">OrgMyMiam</p>
          <h1 className="print-title">{list.title}</h1>
          <p className="print-date">{formatPrintDate()}</p>
          <p className="print-progress">
            {progress.done}/{progress.total} cochés
          </p>
        </header>
        {printGroups.length === 0 ? (
          <p className="print-empty">Liste vide</p>
        ) : (
          printGroups.map((group) => (
            <section key={group.category} className="print-category">
              <h2 className="print-category-title">{group.label}</h2>
              <ul className="print-list">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className={item.checked ? 'print-item checked' : 'print-item'}
                  >
                    <span
                      className={item.checked ? 'print-box checked' : 'print-box'}
                      aria-hidden
                    />
                    <span className="print-item-body">
                      <strong>{item.nameSnapshot}</strong>
                      <span className="print-qty">
                        {formatQuantity(item.quantity, item.unit)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function QtyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden focusable="false">
      <path
        d="M3.5 11.7 11.2 4l1.8 1.8-7.7 7.7H3.5v-1.8Zm8.2-8.9.9-.9a1.2 1.2 0 0 1 1.7 0l.8.8a1.2 1.2 0 0 1 0 1.7l-.9.9-1.8-1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}
