import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  addExtraItemToList,
  createProduct,
  removeShoppingItem,
  softDeleteShoppingList,
  toggleShoppingItem,
  updateShoppingList,
} from '../data/crud';
import type { ProductHit } from '../data/productSearch';
import {
  buildExtraItemFromHit,
  groupItemsByCategory,
  regenerateMealItems,
} from '../data/shoppingList';
import { db } from '../db/database';
import { ProductSearchBox } from './ProductSearchBox';

interface ShoppingListDetailProps {
  listId: string;
  onBack: () => void;
}

export function ShoppingListDetail({ listId, onBack }: ShoppingListDetailProps) {
  const list = useLiveQuery(() => db.shoppingLists.get(listId), [listId]);
  const planTitle = useLiveQuery(async () => {
    if (!list?.mealPlanId) return null;
    const plan = await db.mealPlans.get(list.mealPlanId);
    return plan?.title ?? null;
  }, [list?.mealPlanId]);

  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('unité');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showChecked, setShowChecked] = useState(true);

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
      const item = await buildExtraItemFromHit(hit, qty, unit);
      await addExtraItemToList(listId, item);
      setFeedback(`Extra ajouté : ${hit.name}`);
      setUnit(hit.defaultUnit);
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
      setFeedback(`Extra créé : ${created.product.name}`);
    } finally {
      setBusy(false);
    }
  }

  async function onRegenerate() {
    setBusy(true);
    setFeedback(null);
    try {
      await regenerateMealItems(listId);
      setFeedback('Lignes repas régénérées (extras conservés).');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Régénération impossible');
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
        {list.status === 'open' ? 'Ouverte' : 'Clôturée'}
        {planTitle ? ` · plan « ${planTitle} »` : ' · sans plan'}
        {' · '}
        {progress.done}/{progress.total} cochés
      </p>

      <div className="editor-actions wrap">
        <button type="button" className="ghost-btn" onClick={() => setShowChecked((v) => !v)}>
          {showChecked ? 'Masquer cochés' : 'Afficher cochés'}
        </button>
        {list.mealPlanId ? (
          <button type="button" className="ghost-btn" disabled={busy} onClick={() => void onRegenerate()}>
            Régénérer repas
          </button>
        ) : null}
        <button type="button" className="ghost-btn" onClick={() => void onCloseList()}>
          {list.status === 'open' ? 'Clôturer' : 'Rouvrir'}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="empty">Aucun article — génère depuis un plan ou ajoute un extra.</p>
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
                        {item.quantity} {item.unit}
                        {item.origin === 'extra' ? ' · extra' : ' · repas'}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => void removeShoppingItem(listId, item.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="ingredient-adder">
        <h3 className="subhead">Ajouter un extra</h3>
        <div className="qty-row">
          <label>
            Qté
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
          </label>
          <label>
            Unité
            <input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
        </div>
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
