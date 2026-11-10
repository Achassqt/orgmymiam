import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Recipe, RecipeIngredient } from '@orgmymiam/shared';
import {
  createRecipe,
  resolveIngredientFromHit,
  resolveIngredientFromNewProduct,
  updateRecipe,
} from '../data/crud';
import { lookupProductLabel } from '../data/productSearch';
import type { ProductHit } from '../data/productSearch';
import { formatQuantityOf, roundQty, scaleQuantity } from '../lib/units';
import { ProductSearchBox } from './ProductSearchBox';
import { UnitSelect } from './UnitSelect';
import { VisibilityToggle } from './VisibilityToggle';

interface DraftIngredient extends RecipeIngredient {
  key: string;
  name: string;
}

type PendingDraft =
  | { kind: 'hit'; hit: ProductHit; quantity: string; unit: string }
  | { kind: 'create'; name: string; quantity: string; unit: string };

interface RecipeEditorProps {
  recipe?: Recipe | null;
  onDone: () => void;
  onCancel: () => void;
}

function toDraft(ingredients: RecipeIngredient[], names: Record<string, string>): DraftIngredient[] {
  return ingredients.map((ing, index) => ({
    ...ing,
    key: `${ing.productSource}:${ing.productId}:${index}`,
    name: names[`${ing.productSource}:${ing.productId}`] ?? 'Produit',
  }));
}

function personsLabel(n: number): string {
  return `${n} personne${n === 1 ? '' : 's'}`;
}

export function RecipeEditor({ recipe, onDone, onCancel }: RecipeEditorProps) {
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [pending, setPending] = useState<PendingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nameMap = useLiveQuery(async () => {
    if (!recipe) return {} as Record<string, string>;
    const entries = await Promise.all(
      recipe.ingredients.map(async (ing) => {
        const label = await lookupProductLabel(ing.productId, ing.productSource);
        return [`${ing.productSource}:${ing.productId}`, label] as const;
      }),
    );
    return Object.fromEntries(entries);
  }, [recipe?._id, recipe?.rev]);

  useEffect(() => {
    if (!recipe) {
      setIngredients([]);
      return;
    }
    setTitle(recipe.title);
    setServings(recipe.servings);
    setNotes(recipe.notes);
    setIngredients(toDraft(recipe.ingredients, nameMap ?? {}));
  }, [recipe, nameMap]);

  function onServingsChange(raw: string) {
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 1) {
      setServings(next);
      return;
    }
    const prev = servings;
    if (prev > 0 && ingredients.length > 0 && next !== prev) {
      setIngredients((rows) =>
        rows.map((row) => ({
          ...row,
          quantity: scaleQuantity(row.quantity, prev, next),
        })),
      );
      setNotice(`Quantités adaptées pour ${personsLabel(next)}.`);
    }
    setServings(next);
  }

  function pickHit(hit: ProductHit) {
    setError(null);
    setPending({
      kind: 'hit',
      hit,
      quantity: '1',
      unit: hit.defaultUnit || 'unité',
    });
  }

  function pickCreate(name: string) {
    setError(null);
    setPending({
      kind: 'create',
      name,
      quantity: '1',
      unit: 'unité',
    });
  }

  function clearPending() {
    setPending(null);
  }

  async function confirmPending() {
    if (!pending) return;
    const qty = Number(pending.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantité invalide');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resolved =
        pending.kind === 'hit'
          ? await resolveIngredientFromHit(pending.hit, qty, pending.unit)
          : await resolveIngredientFromNewProduct(pending.name, qty, pending.unit);

      const dupIndex = ingredients.findIndex(
        (row) =>
          row.productId === resolved.productId && row.productSource === resolved.productSource,
      );

      if (dupIndex >= 0) {
        const existing = ingredients[dupIndex]!;
        if (existing.unit !== resolved.unit) {
          setError(
            `« ${resolved.name} » est déjà dans la liste (${existing.quantity} ${existing.unit}). Harmonise l’unité ou retire la ligne.`,
          );
          return;
        }
        setIngredients((prev) =>
          prev.map((row, i) =>
            i === dupIndex
              ? { ...row, quantity: roundQty(row.quantity + resolved.quantity) }
              : row,
          ),
        );
        setNotice(`Quantité de « ${resolved.name} » augmentée.`);
        setPending(null);
        return;
      }

      setIngredients((prev) => [
        ...prev,
        {
          key: crypto.randomUUID(),
          productId: resolved.productId,
          productSource: resolved.productSource,
          quantity: resolved.quantity,
          unit: resolved.unit,
          name: resolved.name,
        },
      ]);
      setNotice(null);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  }

  function updateIngredient(key: string, patch: Partial<Pick<DraftIngredient, 'quantity' | 'unit'>>) {
    setIngredients((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  async function onSave() {
    if (!title.trim()) {
      setError('Titre requis');
      return;
    }
    const servingsNum = Number(servings);
    if (!Number.isFinite(servingsNum) || servingsNum < 1) {
      setError('Nombre de personnes invalide');
      return;
    }
    for (const ing of ingredients) {
      if (!Number.isFinite(ing.quantity) || ing.quantity <= 0) {
        setError(`Quantité invalide pour « ${ing.name} »`);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title,
        servings: servingsNum,
        notes,
        ingredients: ingredients.map(({ productId, productSource, quantity: q, unit: u }) => ({
          productId,
          productSource,
          quantity: roundQty(q),
          unit: u,
        })),
      };
      if (recipe) {
        await updateRecipe(recipe._id, payload);
      } else {
        await createRecipe(payload);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
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
    <div className="editor-panel recipe-editor soft-card">
      <div className="editor-header">
        <h2 className="screen-title editor-title">
          {recipe ? 'Modifier la recette' : 'Nouvelle recette'}
        </h2>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Fermer
        </button>
      </div>

      <div className="stack-form">
        <label>
          Titre
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Pour combien de personnes ?
          <input
            type="number"
            min={1}
            step={1}
            value={servings}
            onChange={(e) => onServingsChange(e.target.value)}
          />
        </label>
        <p className="portions-banner" role="status">
          Quantités pour {personsLabel(Number(servings) > 0 ? Number(servings) : 1)}.
        </p>
        {notice ? <p className="search-notice">{notice}</p> : null}
        <label>
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Astuces, temps de cuisson…"
          />
        </label>
        {recipe ? (
          <VisibilityToggle
            entity="recipes"
            id={recipe._id}
            value={recipe.visibility ?? 'private'}
          />
        ) : null}
      </div>

      <h3 className="subhead">Ingrédients</h3>
      {ingredients.length === 0 ? (
        <p className="empty">Aucun ingrédient pour l’instant.</p>
      ) : (
        <ul className="entity-list ingredient-rows">
          {ingredients.map((ing) => (
            <li key={ing.key}>
              <div className="ingredient-row">
                <strong className="ingredient-name">{ing.name}</strong>
                <div className="qty-row compact">
                  <label>
                    Quantité
                    <input
                      value={String(ing.quantity)}
                      inputMode="decimal"
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        updateIngredient(ing.key, {
                          quantity: Number.isFinite(n) ? n : ing.quantity,
                        });
                      }}
                      aria-label={`Quantité ${ing.name}`}
                    />
                  </label>
                  <label>
                    Unité
                    <UnitSelect
                      value={ing.unit}
                      onChange={(unit) => updateIngredient(ing.key, { unit })}
                    />
                  </label>
                </div>
                <span className="meta">{formatQuantityOf(ing.quantity, ing.unit, ing.name)}</span>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setIngredients((prev) => prev.filter((row) => row.key !== ing.key))}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="ingredient-adder">
        <h4 className="adder-title">Ajouter un ingrédient</h4>
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
                  aria-describedby="recipe-qty-help"
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
            <p id="recipe-qty-help" className="field-help">
              Vérifie la quantité puis confirme. Ex. 400 g, 2 pièces.
            </p>
            <div className="editor-actions wrap">
              <button
                type="button"
                className="primary-btn"
                disabled={busy}
                onClick={() => void confirmPending()}
              >
                Ajouter
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={clearPending}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="field-help">Choisis un produit, puis renseigne la quantité.</p>
            <ProductSearchBox
              busy={busy}
              compact
              placeholder="Chercher un ingrédient…"
              addLabel="Choisir"
              reuseLabel="Choisir"
              onCreate={(name) => pickCreate(name)}
              onSelect={(hit) => pickHit(hit)}
            />
          </>
        )}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="editor-actions">
        <button type="button" className="primary-btn" disabled={busy} onClick={() => void onSave()}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
