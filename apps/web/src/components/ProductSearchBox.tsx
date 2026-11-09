import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  categoryLabel,
  loadProductUniverse,
  searchProductHits,
  type ProductHit,
} from '../data/productSearch';
import { unitDisplayLabel } from '../lib/units';

export interface ProductSearchBoxProps {
  busy?: boolean;
  onCreate: (name: string) => Promise<void> | void;
  onSelect: (hit: ProductHit) => Promise<void> | void;
  placeholder?: string;
  /** Libellé du bouton submit quand pas de match exact */
  addLabel?: string;
  /** Libellé du bouton submit sur match exact */
  reuseLabel?: string;
  /** Mode compact (éditeurs) */
  compact?: boolean;
}

export function ProductSearchBox({
  busy = false,
  onCreate,
  onSelect,
  placeholder = 'Rechercher un produit…',
  addLabel = 'Ajouter',
  reuseLabel = 'Réutiliser',
  compact = false,
}: ProductSearchBoxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const universe = useLiveQuery(() => loadProductUniverse(), []) ?? [];
  const result = useMemo(() => searchProductHits(universe, query), [universe, query]);

  const options = useMemo(() => {
    const rows: Array<{ kind: 'hit'; hit: ProductHit } | { kind: 'create'; name: string }> = result.hits.map(
      (hit) => ({ kind: 'hit' as const, hit }),
    );
    if (result.canCreate && query.trim()) {
      rows.push({ kind: 'create', name: query.trim() });
    }
    return rows;
  }, [result, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  async function submitCreate(name: string) {
    setNotice(null);
    await onCreate(name);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  async function submitSelect(hit: ProductHit) {
    setNotice(null);
    await onSelect(hit);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || busy) return;

    if (result.exactMatch) {
      setNotice(`Produit trouvé : « ${result.exactMatch.name} ».`);
      await submitSelect(result.exactMatch);
      return;
    }

    await submitCreate(query.trim());
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open || options.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option.kind === 'create') {
        void submitCreate(option.name);
      } else {
        void submitSelect(option.hit);
      }
    }
  }

  return (
    <div className="product-search">
      <form className="inline-form" onSubmit={(e) => void onSubmit(e)} autoComplete="off">
        <div className="product-search-field">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && options[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined
            }
            placeholder={placeholder}
            value={query}
            disabled={busy}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setNotice(null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
          />

          {open && query.trim() && options.length > 0 ? (
            <ul id={listId} className="suggest-list" role="listbox">
              {options.map((option, index) => {
                if (option.kind === 'create') {
                  return (
                    <li key="create" role="option" aria-selected={index === activeIndex}>
                      <button
                        type="button"
                        id={`${listId}-opt-${index}`}
                        className={
                          index === activeIndex ? 'suggest-item create active' : 'suggest-item create'
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void submitCreate(option.name)}
                      >
                        Créer « {option.name} »
                        <span className="meta">nouveau produit</span>
                      </button>
                    </li>
                  );
                }

                const { hit } = option;
                return (
                  <li key={hit.id} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      id={`${listId}-opt-${index}`}
                      className={index === activeIndex ? 'suggest-item active' : 'suggest-item'}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void submitSelect(hit)}
                    >
                      <span className="suggest-main">
                        <strong>{hit.name}</strong>
                      </span>
                      <span className="meta">
                        {categoryLabel(hit.category)} · unité {unitDisplayLabel(hit.defaultUnit)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <button type="submit" className="primary-btn" disabled={busy || !query.trim()}>
          {result.exactMatch ? reuseLabel : addLabel}
        </button>
      </form>

      {!compact && result.exactMatch && query.trim() ? (
        <p className="search-hint">Déjà connu : « {result.exactMatch.name} » — on le réutilise.</p>
      ) : null}

      {!compact && notice ? <p className="search-notice">{notice}</p> : null}
    </div>
  );
}
