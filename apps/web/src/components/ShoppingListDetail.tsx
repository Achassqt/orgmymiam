import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import {
  addExtraItemToList,
  createProduct,
  removeShoppingItem,
  reorderShoppingItems,
  softDeleteShoppingList,
  toggleShoppingItem,
  updateShoppingItemFields,
  updateShoppingList,
} from '../data/crud';
import { getCachedHousehold } from '../data/household';
import type { ProductHit } from '../data/productSearch';
import {
  buildExtraItemFromHit,
  orderedShoppingItems,
  regenerateMealItems,
} from '../data/shoppingList';
import { db } from '../db/database';
import { useHousehold } from '../hooks/useHousehold';
import { initialsFromName } from '../lib/initials';
import { formatPlanDate } from '../lib/planDates';
import {
  formatPrintDate,
  formatShoppingListShareText,
} from '../lib/shoppingListShare';
import { formatQuantity } from '../lib/units';
import { runSync } from '../sync/engine';
import { ActionMenu, ActionMenuItem } from './ActionMenu';
import { ProductSearchBox } from './ProductSearchBox';
import { TrashIcon } from './icons';
import { useToast } from './ToastHost';
import { UnitSelect } from './UnitSelect';
import { HouseholdBadge, VisibilityToggle } from './VisibilityToggle';

interface ShoppingListDetailProps {
  listId: string;
  onBack: () => void;
}

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

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('unité');
  const [editNote, setEditNote] = useState('');

  // Polling sync 8s tant que le détail liste est ouvert
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void runSync('shopping-poll');
      }
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [listId]);

  const items = useMemo(() => (list ? orderedShoppingItems(list.items) : []), [list]);

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
        <button type="button" className="back-link" onClick={onBack}>
          ← Retour
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

  async function persistExtraHit(hit: ProductHit) {
    const item = await buildExtraItemFromHit(hit, 1, hit.defaultUnit || 'unité');
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
    if (before) {
      setFeedback(`Quantité de « ${hit.name} » augmentée.`);
      setExpandedId(before.id);
      setEditQty(String(before.quantity + item.quantity));
      setEditUnit(before.unit);
      setEditNote(before.note ?? '');
    } else {
      setFeedback(`Ajouté : ${hit.name}`);
      setExpandedId(item.id);
      setEditQty(String(item.quantity));
      setEditUnit(item.unit);
      setEditNote('');
    }
  }

  async function addHitDirect(hit: ProductHit) {
    setBusy(true);
    setFeedback(null);
    try {
      await persistExtraHit(hit);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  }

  async function addCreateDirect(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setFeedback(null);
    try {
      const created = await createProduct({ name: trimmed, defaultUnit: 'unité' });
      const hit: ProductHit = {
        id: `user:${created.product._id}`,
        name: created.product.name,
        nameNormalized: created.product.nameNormalized,
        category: created.product.category,
        defaultUnit: created.product.defaultUnit,
        source: 'user',
        userProductId: created.product._id,
      };
      await persistExtraHit(hit);
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

  function openExpand(itemId: string, quantity: number, unit: string, note: string) {
    if (expandedId === itemId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(itemId);
    setEditQty(String(quantity));
    setEditUnit(unit);
    setEditNote(note);
  }

  async function saveExpand(itemId: string) {
    const qty = Number(editQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFeedback('Quantité invalide');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await updateShoppingItemFields(listId, itemId, {
        quantity: qty,
        unit: editUnit,
        note: editNote,
      });
      setExpandedId(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Modification impossible');
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(itemId: string, direction: -1 | 1) {
    const ids = items.map((i) => i.id);
    const index = ids.indexOf(itemId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    setBusy(true);
    try {
      await reorderShoppingItems(listId, next);
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    if (!list) return;
    const text = formatShoppingListShareText(list.title, list.items, list.notes);
    const title = list.title;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
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

  const canRegenerate = Boolean(list.mealPlanId || (list.rangeFrom && list.rangeTo));

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
            {canRegenerate ? (
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
        {list.notes ? <p className="list-notes">{list.notes}</p> : null}
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
            {list.rangeFrom && list.rangeTo
              ? ` · ${
                  list.rangeFrom === list.rangeTo
                    ? formatPlanDate(list.rangeFrom)
                    : `${formatPlanDate(list.rangeFrom)} → ${formatPlanDate(list.rangeTo)}`
                }`
              : list.mealPlanId
                ? ' · depuis planning'
                : ' · sans planning'}
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

        {items.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Liste vide</p>
            <p className="empty-state-desc">
              Ajoute un produit ci-dessous, ou reviens générer depuis le planning.
            </p>
          </div>
        ) : (
          <ul className="shop-list shop-list-flat">
            {items.map((item, index) => {
              const expanded = expandedId === item.id;
              const note = item.note ?? '';
              return (
                <li
                  key={item.id}
                  className={
                    item.checked
                      ? expanded
                        ? 'shop-item checked is-expanded'
                        : 'shop-item checked'
                      : expanded
                        ? 'shop-item is-expanded'
                        : 'shop-item'
                  }
                >
                  <div className="shop-item-main">
                    <label className="shop-check">
                      <input
                        className="shop-check-input"
                        type="checkbox"
                        checked={item.checked}
                        disabled={busy}
                        aria-label={
                          item.checked
                            ? `Décocher ${item.nameSnapshot}`
                            : `Cocher ${item.nameSnapshot}`
                        }
                        onChange={() => void onToggle(item.id)}
                      />
                      <span className="shop-check-box" aria-hidden />
                      <span className="shop-check-body">
                        <strong>{item.nameSnapshot}</strong>
                        <span className="meta">
                          {formatQuantity(item.quantity, item.unit)}
                          {item.origin === 'extra' ? ' · ajouté' : ''}
                        </span>
                        {note ? <span className="shop-item-note">{note}</span> : null}
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
                    <button
                      type="button"
                      className="icon-btn soft shop-expand-btn"
                      aria-expanded={expanded}
                      aria-label={
                        expanded
                          ? `Fermer l’édition de ${item.nameSnapshot}`
                          : `Modifier ${item.nameSnapshot}`
                      }
                      disabled={busy}
                      onClick={() =>
                        openExpand(item.id, item.quantity, item.unit, note)
                      }
                    >
                      <ChevronIcon open={expanded} />
                    </button>
                  </div>

                  {expanded ? (
                    <div className="shop-item-expand stack-form">
                      <div className="qty-row">
                        <label>
                          Quantité
                          <input
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            inputMode="decimal"
                            aria-label={`Quantité pour ${item.nameSnapshot}`}
                            disabled={busy}
                          />
                        </label>
                        <label>
                          Unité
                          <UnitSelect
                            value={editUnit}
                            onChange={setEditUnit}
                            disabled={busy}
                          />
                        </label>
                      </div>
                      <label>
                        Note
                        <input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Ex. marque, rayon…"
                          disabled={busy}
                          maxLength={500}
                        />
                      </label>
                      <div className="shop-expand-actions">
                        <button
                          type="button"
                          className="icon-btn soft"
                          disabled={busy || index === 0}
                          aria-label="Monter"
                          title="Monter"
                          onClick={() => void moveItem(item.id, -1)}
                        >
                          <ArrowIcon dir="up" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn soft"
                          disabled={busy || index === items.length - 1}
                          aria-label="Descendre"
                          title="Descendre"
                          onClick={() => void moveItem(item.id, 1)}
                        >
                          <ArrowIcon dir="down" />
                        </button>
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={busy}
                          onClick={() => void saveExpand(item.id)}
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          className="icon-btn soft"
                          aria-label={`Supprimer ${item.nameSnapshot}`}
                          title="Supprimer"
                          disabled={busy}
                          onClick={() => {
                            setExpandedId(null);
                            void removeShoppingItem(listId, item.id);
                          }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="ingredient-adder">
          <h3 className="subhead">Ajouter un produit</h3>
          <p className="field-help">Sélectionne un produit pour l’ajouter tout de suite.</p>
          <ProductSearchBox
            busy={busy}
            compact
            hideHitMeta
            placeholder="Ex. éponge, snacks…"
            addLabel="Ajouter"
            reuseLabel="Ajouter"
            onCreate={(name) => void addCreateDirect(name)}
            onSelect={(hit) => void addHitDirect(hit)}
          />
        </div>

        {feedback ? <p className="search-notice">{feedback}</p> : null}
      </div>

      <div className="print-sheet" aria-hidden="true">
        <header className="print-sheet-header">
          <p className="print-brand">OrgMyMiam</p>
          <h1 className="print-title">{list.title}</h1>
          {list.notes ? <p className="print-notes">{list.notes}</p> : null}
          <p className="print-date">{formatPrintDate()}</p>
          <p className="print-progress">
            {progress.done}/{progress.total} cochés
          </p>
        </header>
        {items.length === 0 ? (
          <p className="print-empty">Liste vide</p>
        ) : (
          <ul className="print-list">
            {items.map((item) => (
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
                  {item.note ? <span className="print-item-note">{item.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }}
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === 'up' ? 'm6 14 6-6 6 6' : 'm6 10 6 6 6-6'}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
