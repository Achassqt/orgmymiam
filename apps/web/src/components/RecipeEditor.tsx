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
import { formatQuantityOf } from '../lib/units';
import { ProductSearchBox } from './ProductSearchBox';
import { UnitSelect } from './UnitSelect';

interface DraftIngredient extends RecipeIngredient {
  key: string;
  name: string;
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

export function RecipeEditor({ recipe, onDone, onCancel }: RecipeEditorProps) {
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('unité');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitHint, setUnitHint] = useState<string | null>(null);

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

  async function addFromHit(hit: ProductHit) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantité invalide');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextUnit = hit.defaultUnit || unit;
      const ing = await resolveIngredientFromHit(hit, qty, nextUnit);
      setIngredients((prev) => [
        ...prev,
        {
          key: crypto.randomUUID(),
          productId: ing.productId,
          productSource: ing.productSource,
          quantity: ing.quantity,
          unit: ing.unit,
          name: ing.name,
        },
      ]);
      setUnit(nextUnit);
      setUnitHint(`Unité préremplie : ${nextUnit} (modifiable)`);
    } finally {
      setBusy(false);
    }
  }

  async function addFromCreate(name: string) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantité invalide');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ing = await resolveIngredientFromNewProduct(name, qty, unit);
      setIngredients((prev) => [
        ...prev,
        {
          key: crypto.randomUUID(),
          productId: ing.productId,
          productSource: ing.productSource,
          quantity: ing.quantity,
          unit: ing.unit,
          name: ing.name,
        },
      ]);
      setUnitHint(null);
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!title.trim()) {
      setError('Titre requis');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title,
        servings: Number(servings) || 1,
        notes,
        ingredients: ingredients.map(({ productId, productSource, quantity: q, unit: u }) => ({
          productId,
          productSource,
          quantity: q,
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

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <h2>{recipe ? 'Modifier la recette' : 'Nouvelle recette'}</h2>
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
            onChange={(e) => setServings(Number(e.target.value))}
          />
        </label>
        <label>
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Astuces, temps de cuisson…"
          />
        </label>
      </div>

      <h3 className="subhead">Ingrédients</h3>
      {ingredients.length === 0 ? (
        <p className="empty">Aucun ingrédient pour l’instant.</p>
      ) : (
        <ul className="entity-list">
          {ingredients.map((ing) => (
            <li key={ing.key}>
              <div>
                <strong>{formatQuantityOf(ing.quantity, ing.unit, ing.name)}</strong>
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
        <div className="qty-row">
          <label>
            Quantité
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              aria-describedby="recipe-qty-help"
            />
          </label>
          <label>
            Unité
            <UnitSelect
              value={unit}
              onChange={(next) => {
                setUnit(next);
                setUnitHint(null);
              }}
            />
          </label>
        </div>
        <p id="recipe-qty-help" className="field-help">
          Ex. 400 g, 2 pièces. L’unité se préremplit quand tu choisis un produit.
        </p>
        {unitHint ? <p className="field-help">{unitHint}</p> : null}
        <ProductSearchBox
          busy={busy}
          compact
          placeholder="Ajouter un ingrédient…"
          addLabel="Créer"
          reuseLabel="Choisir"
          onCreate={(name) => void addFromCreate(name)}
          onSelect={(hit) => void addFromHit(hit)}
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
