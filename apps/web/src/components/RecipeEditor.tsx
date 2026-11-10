import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Recipe, RecipeIngredient } from '@orgmymiam/shared';
import {
  createProduct,
  createRecipe,
  resolveIngredientFromHit,
  updateRecipe,
} from '../data/crud';
import { lookupProductLabel } from '../data/productSearch';
import type { ProductHit } from '../data/productSearch';
import { formatQuantityOf, roundQty, scaleQuantity } from '../lib/units';
import { ProductSearchBox } from './ProductSearchBox';
import { TrashIcon } from './icons';
import { UnitSelect } from './UnitSelect';
import { VisibilityToggle } from './VisibilityToggle';

interface DraftIngredient extends RecipeIngredient {
  key: string;
  name: string;
  /** Nouveau produit : écriture BDD seulement à l’enregistrement de la recette. */
  pendingCreateName?: string;
}

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

function mergeOrAppend(
  rows: DraftIngredient[],
  next: DraftIngredient,
): { rows: DraftIngredient[]; notice: string | null; error: string | null } {
  const dupIndex = rows.findIndex((row) => {
    if (next.pendingCreateName) {
      return (
        row.pendingCreateName != null &&
        row.pendingCreateName.trim().toLowerCase() === next.pendingCreateName.trim().toLowerCase()
      );
    }
    return (
      !row.pendingCreateName &&
      row.productId === next.productId &&
      row.productSource === next.productSource
    );
  });

  if (dupIndex < 0) {
    return { rows: [...rows, next], notice: null, error: null };
  }

  const existing = rows[dupIndex]!;
  if (existing.unit !== next.unit) {
    return {
      rows,
      notice: null,
      error: `« ${next.name} » est déjà dans la liste (${existing.quantity} ${existing.unit}). Harmonise l’unité ou retire la ligne.`,
    };
  }

  return {
    rows: rows.map((row, i) =>
      i === dupIndex ? { ...row, quantity: roundQty(row.quantity + next.quantity) } : row,
    ),
    notice: `Quantité de « ${next.name} » augmentée.`,
    error: null,
  };
}

export function RecipeEditor({ recipe, onDone, onCancel }: RecipeEditorProps) {
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
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
      setNotice(`Quantités mises à jour pour ${personsLabel(next)}.`);
    }
    setServings(next);
  }

  async function pickHit(hit: ProductHit) {
    setError(null);
    try {
      const resolved = await resolveIngredientFromHit(hit, 1, hit.defaultUnit || 'unité');
      const next: DraftIngredient = {
        key: crypto.randomUUID(),
        productId: resolved.productId,
        productSource: resolved.productSource,
        quantity: resolved.quantity,
        unit: resolved.unit,
        name: resolved.name,
      };
      const result = mergeOrAppend(ingredients, next);
      setIngredients(result.rows);
      setNotice(result.notice);
      setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajout impossible');
    }
  }

  function pickCreate(name: string) {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const next: DraftIngredient = {
      key: crypto.randomUUID(),
      productId: crypto.randomUUID(),
      productSource: 'user',
      quantity: 1,
      unit: 'unité',
      name: trimmed,
      pendingCreateName: trimmed,
    };
    const result = mergeOrAppend(ingredients, next);
    setIngredients(result.rows);
    setNotice(result.notice);
    setError(result.error);
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
      const resolvedIngredients: RecipeIngredient[] = [];
      for (const ing of ingredients) {
        if (ing.pendingCreateName) {
          const created = await createProduct({
            name: ing.pendingCreateName,
            defaultUnit: ing.unit,
          });
          resolvedIngredients.push({
            productId: created.product._id,
            productSource: 'user',
            quantity: roundQty(ing.quantity),
            unit: ing.unit,
          });
        } else {
          resolvedIngredients.push({
            productId: ing.productId,
            productSource: ing.productSource,
            quantity: roundQty(ing.quantity),
            unit: ing.unit,
          });
        }
      }

      const payload = {
        title,
        servings: servingsNum,
        notes,
        ingredients: resolvedIngredients,
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

  return (
    <div className="editor-panel recipe-editor soft-card">
      <div className="editor-header editor-header-stack editor-header-left">
        <button type="button" className="back-link" onClick={onCancel}>
          ← Retour
        </button>
        <h2 className="screen-title editor-title">
          {recipe ? 'Modifier la recette' : 'Nouvelle recette'}
        </h2>
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
          Les quantités suivent le nombre de personnes ({personsLabel(
            Number(servings) > 0 ? Number(servings) : 1,
          )}
          ).
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
                className="icon-btn soft"
                aria-label={`Supprimer ${ing.name}`}
                title="Supprimer"
                onClick={() => setIngredients((prev) => prev.filter((row) => row.key !== ing.key))}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="ingredient-adder">
        <h4 className="adder-title">Ajouter un ingrédient</h4>
        <p className="field-help">
          Choisis un produit : il s’ajoute tout de suite. Tu peux ensuite modifier la quantité et
          l’unité.
        </p>
        <ProductSearchBox
          busy={busy}
          compact
          hideHitMeta
          placeholder="Chercher un ingrédient…"
          addLabel="Ajouter"
          reuseLabel="Ajouter"
          onCreate={(name) => pickCreate(name)}
          onSelect={(hit) => void pickHit(hit)}
        />
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
