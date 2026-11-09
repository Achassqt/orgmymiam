import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  addExtraItemToList,
  createProduct,
  removeShoppingItem,
  softDeleteShoppingList,
  toggleShoppingItem,
  updateShoppingItemQuantity,
  updateShoppingList,
} from '../data/crud';
import type { ProductHit } from '../data/productSearch';
import {
  buildExtraItemFromHit,
  groupItemsByCategory,
  regenerateMealItems,
} from '../data/shoppingList';
import { db } from '../db/database';
import { formatQuantity } from '../lib/units';
import { ProductSearchBox } from './ProductSearchBox';
import { UnitSelect } from './UnitSelect';

interface ShoppingListDetailProps {
  listId: string;
  onBack: () => void;
}

export function ShoppingListDetail({ listId, onBack }: ShoppingListDetailProps) {
  const list = useLiveQuery(() => db.shoppingLists.get(listId), [listId]);
  const planInfo = useLiveQuery(async () => {
    if (!list?.mealPlanId) return null;
    const plan = await db.mealPlans.get(list.mealPlanId);
    if (!plan) return null;
    const servings = plan.slots
      .map((slot) => slot.servingsOverride)
      .filter((n): n is number => n != null && n > 0);
    const unique = [...new Set(servings)];
    return {
      title: plan.title,
      portionsHint:
        unique.length === 1
          ? `Quantités pour ${unique[0]} personne${unique[0] === 1 ? '' : 's'} (selon le planning)`
          : 'Quantités selon les portions de chaque repas du planning',
    };
  }, [list?.mealPlanId]);

  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('unité');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showChecked, setShowChecked] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

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

  async function addExtraFromHit(hit: ProductHit) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFeedback('Quantité invalide');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const nextUnit = hit.defaultUnit || unit;
      const item = await buildExtraItemFromHit(hit, qty, nextUnit);
      await addExtraItemToList(listId, item);
      setFeedback(`Ajouté : ${hit.name}`);
      setUnit(nextUnit);
    } finally {
      setBusy(false);
    }
  }

  async function addExtraFromCreate(name: string) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFeedback('Quantité invalide');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const created = await createProduct({ name });
      const hit: ProductHit = {
        id: `user:${created.product._id}`,
        name: created.product.name,
        nameNormalized: created.product.nameNormalized,
        category: created.product.category,
        defaultUnit: created.product.defaultUnit,
        source: 'user',
        userProductId: created.product._id,
      };
      const item = await buildExtraItemFromHit(hit, qty, unit || created.product.defaultUnit);
      await addExtraItemToList(listId, item);
      setFeedback(`Ajouté : ${created.product.name}`);
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

  function startEditQty(itemId: string, current: number) {
    setEditingId(itemId);
    setEditQty(String(current));
  }

  async function saveEditQty(itemId: string) {
    const qty = Number(editQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFeedback('Quantité invalide');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await updateShoppingItemQuantity(listId, itemId, qty);
      setEditingId(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Modification impossible');
    } finally {
      setBusy(false);
    }
  }

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

      <h1>{list.title}</h1>
      <p className="lede">
        {list.status === 'open' ? 'Ouverte' : 'Terminée'}
        {planInfo ? ` · planning « ${planInfo.title} »` : ' · sans planning'}
        {' · '}
        {progress.done}/{progress.total} cochés
      </p>
      {planInfo ? <p className="field-help">{planInfo.portionsHint}</p> : null}

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
        <p className="empty">Aucun article — génère depuis un planning ou ajoute un produit.</p>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="category-block">
            <h2 className="category-title">{group.label}</h2>
            <ul className="shop-list">
              {group.items.map((item) => (
                <li key={item.id} className={item.checked ? 'shop-item checked' : 'shop-item'}>
                  <label className="shop-check">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={busy}
                      onChange={() => void onToggle(item.id)}
                    />
                    <span>
                      <strong>{item.nameSnapshot}</strong>
                      <span className="meta">
                        {formatQuantity(item.quantity, item.unit)}
                        {item.origin === 'extra' ? ' · ajouté' : ' · repas'}
                      </span>
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
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={busy}
                          onClick={() => void saveEditQty(item.id)}
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
                        onClick={() => startEditQty(item.id, item.quantity)}
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
        <div className="qty-row">
          <label>
            Quantité
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
          </label>
          <label>
            Unité
            <UnitSelect value={unit} onChange={setUnit} />
          </label>
        </div>
        <p className="field-help">L’unité se préremplit selon le produit choisi.</p>
        <ProductSearchBox
          busy={busy}
          compact
          placeholder="Ex. éponge, snacks…"
          addLabel="Créer"
          reuseLabel="Ajouter"
          onCreate={(name) => void addExtraFromCreate(name)}
          onSelect={(hit) => void addExtraFromHit(hit)}
        />
      </div>

      {feedback ? <p className="search-notice">{feedback}</p> : null}
    </div>
  );
}
