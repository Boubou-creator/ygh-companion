'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  Copy,
  Database,
  Download,
  FolderOpen,
  Layers3,
  LayoutGrid,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import type { Card, CatalogResponse, CatalogStatus, Deck, Entry, Zone } from '@/lib/types';
import { demoCards } from '@/lib/seed';
import { parseYdk, toYdk, validateDeck } from '@/lib/rules';
import CardArt from './card-art';
import Modal from './modal';
import AnalysisView from './analysis-view';
import DeckLibrary from './deck-library';

type View = 'builder' | 'catalog' | 'decks' | 'analysis';
const zones: { id: Zone; label: string; max: number; subtitle: string }[] = [
  { id: 'main', label: 'Main Deck', max: 60, subtitle: '40–60 cartes' },
  { id: 'extra', label: 'Extra Deck', max: 15, subtitle: '0–15 cartes' },
  { id: 'side', label: 'Side Deck', max: 15, subtitle: '0–15 cartes' },
];
const starter: Entry[] = [
  [46986414, 3],
  [7084129, 3],
  [97631303, 3],
  [14558127, 3],
  [97268402, 2],
  [59822133, 2],
  [47222536, 3],
  [2314238, 3],
  [59514116, 2],
  [48680970, 2],
  [10045474, 3],
].map(([cardId, quantity]) => ({ cardId, quantity, zone: 'main' }));
starter.push(
  { cardId: 50237654, quantity: 2, zone: 'extra' },
  { cardId: 37818794, quantity: 1, zone: 'extra' },
  { cardId: 62873545, quantity: 1, zone: 'extra' },
);
const initialDraft = { name: 'Dark Magician', entries: starter };
async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data as T;
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function deckSignature(name: string, entries: Entry[]) {
  return JSON.stringify({
    name,
    entries: entries
      .map(({ cardId, zone, quantity }) => ({ cardId, zone, quantity }))
      .sort((a, b) => a.zone.localeCompare(b.zone) || a.cardId - b.cardId),
  });
}
export default function DeckBuilder() {
  const [view, setView] = useState<View>('builder');
  const [entries, setEntries] = useState<Entry[]>(initialDraft.entries);
  const [name, setName] = useState(initialDraft.name);
  const [deckId, setDeckId] = useState<string>();
  const [version, setVersion] = useState<number>();
  const [savedSignature, setSavedSignature] = useState('');
  const [ready, setReady] = useState(false);
  const [known, setKnown] = useState<Record<number, Card>>(() =>
    Object.fromEntries(demoCards.map((c) => [c.id, c])),
  );
  const [result, setResult] = useState<CatalogResponse>();
  const [status, setStatus] = useState<CatalogStatus>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [attribute, setAttribute] = useState('');
  const [level, setLevel] = useState('');
  const [archetype, setArchetype] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [selected, setSelected] = useState<number>(46986414);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [target, setTarget] = useState<Zone>('main');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ text: string; error: boolean }>();
  const [savedDecks, setSavedDecks] = useState<Deck[]>([]);
  const [modal, setModal] = useState<'catalog' | 'validation' | 'help' | null>(null);
  const [probabilityIds, setProbabilityIds] = useState<number[]>([14558127, 97268402]);
  const ydkInput = useRef<HTMLInputElement>(null),
    catalogInput = useRef<HTMLInputElement>(null);
  const notify = (text: string, error = false) => setNotice({ text, error });
  const signature = deckSignature(name, entries);
  const dirty = signature !== savedSignature;
  const deckCards = useMemo(() => Object.values(known), [known]);
  const validation = useMemo(() => validateDeck(entries, deckCards), [entries, deckCards]);
  const active = known[selected];
  const uniqueIds = [...new Set(entries.map((e) => e.cardId))].sort((a, b) => a - b).join(',');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ygh-draft-v1');
      if (raw) {
        const value = JSON.parse(raw);
        if (
          typeof value.name === 'string' &&
          Array.isArray(value.entries) &&
          value.entries.length <= 120 &&
          value.entries.every(
            (e: Entry) =>
              Number.isInteger(e.cardId) &&
              e.cardId > 0 &&
              ['main', 'extra', 'side'].includes(e.zone) &&
              Number.isInteger(e.quantity) &&
              e.quantity > 0 &&
              e.quantity <= 120,
          )
        ) {
          setName(value.name);
          setEntries(value.entries);
          setDeckId(value.id);
          setVersion(value.version);
          setSavedSignature(value.savedSignature || '');
        }
      }
    } catch {
      /* A damaged local draft must not prevent starting the editor. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        'ygh-draft-v1',
        JSON.stringify({ name, entries, id: deckId, version, savedSignature }),
      );
    } catch {
      setNotice({
        text: 'Stockage du navigateur indisponible. Pensez à enregistrer votre deck.',
        error: true,
      });
    }
  }, [name, entries, deckId, version, savedSignature, ready]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setCatalogError('');
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        q: query,
        category,
        attribute,
        level,
        archetype,
        page: String(page),
      });
      jsonRequest<CatalogResponse>(`/api/cards?${params}`, { signal: controller.signal })
        .then((data) => {
          setResult(data);
          setStatus(data.status);
          setKnown((old) => ({ ...old, ...Object.fromEntries(data.cards.map((c) => [c.id, c])) }));
        })
        .catch((error) => {
          if (error.name !== 'AbortError')
            setCatalogError('Le catalogue est indisponible. Réessayez.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, category, attribute, level, archetype, page, refresh]);
  useEffect(() => {
    if (!uniqueIds) return;
    const controller = new AbortController();
    jsonRequest<{ cards: Card[] }>(`/api/cards?ids=${uniqueIds}`, { signal: controller.signal })
      .then((data) =>
        setKnown((old) => ({ ...old, ...Object.fromEntries(data.cards.map((c) => [c.id, c])) })),
      )
      .catch((error) => {
        if (error.name !== 'AbortError')
          setNotice({ text: 'Impossible de charger les cartes du deck.', error: true });
      });
    return () => controller.abort();
  }, [uniqueIds, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(undefined), 6500);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (view !== 'decks') return;
    jsonRequest<{ decks: Deck[] }>('/api/decks')
      .then((data) => setSavedDecks(data.decks))
      .catch((error) => notify(error.message, true));
  }, [view]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null);
        setInspectorOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  function addCard(card: Card, zone: Zone = target) {
    const destination = zone === 'side' ? zone : card.extra ? 'extra' : 'main';
    const quantity = entries
      .filter((e) => e.cardId === card.id)
      .reduce((sum, e) => sum + e.quantity, 0);
    if (quantity >= 3)
      return notify('Maximum de trois exemplaires, toutes zones confondues.', true);
    if (validation.counts[destination] >= (destination === 'main' ? 60 : 15))
      return notify('Cette zone est pleine.', true);
    setEntries((old) => {
      const existing = old.find((e) => e.cardId === card.id && e.zone === destination);
      return existing
        ? old.map((e) => (e === existing ? { ...e, quantity: e.quantity + 1 } : e))
        : [...old, { cardId: card.id, zone: destination, quantity: 1 }];
    });
    setSelected(card.id);
  }
  function removeCard(cardId: number, zone: Zone) {
    setEntries((old) =>
      old.flatMap((e) =>
        e.cardId === cardId && e.zone === zone
          ? e.quantity > 1
            ? [{ ...e, quantity: e.quantity - 1 }]
            : []
          : [e],
      ),
    );
  }
  function drop(event: React.DragEvent, zone: Zone) {
    event.preventDefault();
    try {
      const data = JSON.parse(event.dataTransfer.getData('application/ygh-card'));
      const card = known[data.cardId];
      if (!card) return;
      if (!data.zone) return addCard(card, zone);
      if (data.zone === zone) return;
      if (zone !== 'side' && card.extra !== (zone === 'extra'))
        return notify('Ce type de carte ne peut pas rejoindre cette zone.', true);
      if (validation.counts[zone] >= (zone === 'main' ? 60 : 15))
        return notify('Cette zone est pleine.', true);
      setEntries((old) => {
        const next = old.flatMap((e) =>
          e.cardId === card.id && e.zone === data.zone
            ? e.quantity > 1
              ? [{ ...e, quantity: e.quantity - 1 }]
              : []
            : [e],
        );
        const existing = next.find((e) => e.cardId === card.id && e.zone === zone);
        return existing
          ? next.map((e) => (e === existing ? { ...e, quantity: e.quantity + 1 } : e))
          : [...next, { cardId: card.id, zone, quantity: 1 }];
      });
    } catch {
      /* Ignore unrelated dragged content. */
    }
  }
  async function save(asNew = false) {
    if (!name.trim()) return notify('Donnez un nom à votre deck.', true);
    setBusy('save');
    const snapshot = {
      name: name.trim(),
      entries: [...entries],
      ...(!asNew && deckId ? { id: deckId, version } : {}),
    };
    try {
      const data = await jsonRequest<{ deck: Deck }>('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
      setDeckId(data.deck.id);
      setVersion(data.deck.version);
      setName((old) => (old === name ? data.deck.name : old));
      setSavedSignature(deckSignature(data.deck.name, data.deck.entries));
      notify(asNew ? 'Copie enregistrée dans Mes decks.' : 'Deck enregistré dans la base locale.');
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy('');
    }
  }
  function newDeck() {
    if (busy) return notify('Attendez la fin de l’opération en cours.');
    if (
      dirty &&
      !window.confirm('Remplacer le brouillon actuel ? Enregistrez-le pour le conserver.')
    )
      return;
    setEntries([]);
    setName('Mon nouveau deck');
    setDeckId(undefined);
    setVersion(undefined);
    setSavedSignature('');
    setView('builder');
  }
  async function loadDeck(deck: Deck) {
    if (busy) return notify('Attendez la fin de l’opération en cours.');
    if (dirty && !window.confirm('Ouvrir ce deck et remplacer le brouillon actuel ?')) return;
    try {
      const data = await jsonRequest<{ cards: Card[] }>(
        `/api/cards?ids=${deck.entries.map((e) => e.cardId).join(',')}`,
      );
      setKnown((old) => ({ ...old, ...Object.fromEntries(data.cards.map((c) => [c.id, c])) }));
      setEntries(deck.entries);
      setName(deck.name);
      setDeckId(deck.id);
      setVersion(deck.version);
      setSavedSignature(deckSignature(deck.name, deck.entries));
      setView('builder');
    } catch (error) {
      notify((error as Error).message, true);
    }
  }
  async function deleteDeck(deck: Deck) {
    if (!window.confirm(`Supprimer « ${deck.name} » ?`)) return;
    try {
      await jsonRequest(`/api/decks/${deck.id}`, { method: 'DELETE' });
      setSavedDecks((old) => old.filter((d) => d.id !== deck.id));
      if (deckId === deck.id) {
        setDeckId(undefined);
        setVersion(undefined);
        setSavedSignature('');
      }
      notify('Deck supprimé.');
    } catch (error) {
      notify((error as Error).message, true);
    }
  }
  async function importYdk(file?: File) {
    if (!file) return;
    if (file.size > 100_000) return notify('Fichier YDK trop volumineux.', true);
    try {
      const imported = parseYdk(await file.text());
      const ids = [...new Set(imported.map((e) => e.cardId))];
      const data = await jsonRequest<{ cards: Card[] }>(`/api/cards?ids=${ids.join(',')}`);
      const missing = ids.filter((id) => !data.cards.some((card) => card.id === id));
      if (missing.length)
        throw new Error(
          `${missing.length} carte(s) absente(s) du catalogue. Synchronisez le catalogue avant cet import.`,
        );
      if (dirty && !window.confirm('Importer ce deck et remplacer le brouillon actuel ?')) return;
      setKnown((old) => ({ ...old, ...Object.fromEntries(data.cards.map((c) => [c.id, c])) }));
      setEntries(imported);
      setName(file.name.replace(/\.ydk$/i, ''));
      setDeckId(undefined);
      setVersion(undefined);
      setSavedSignature('');
      setView('builder');
      notify('Deck YDK importé.');
    } catch (error) {
      notify((error as Error).message, true);
    }
  }
  async function synchronize(file?: File) {
    if (file && file.size > 30_000_000) return notify('Fichier JSON limité à 30 Mo.', true);
    setBusy('sync');
    try {
      const text = file ? await file.text() : undefined;
      const data = await jsonRequest<CatalogStatus>(`/api/catalog${file ? '?action=import' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      setStatus(data);
      setRefresh((old) => old + 1);
      setModal(null);
      notify(`${data.count.toLocaleString('fr-FR')} cartes disponibles. Catalogue mis à jour.`);
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy('');
    }
  }
  function clearFilters() {
    setQuery('');
    setCategory('');
    setAttribute('');
    setLevel('');
    setArchetype('');
    setPage(1);
  }
  const filtersCount = [attribute, level, archetype].filter(Boolean).length;
  const monsterCount = entries
    .filter((e) => e.zone === 'main' && known[e.cardId]?.category === 'Monster')
    .reduce((sum, e) => sum + e.quantity, 0);
  const spellCount = entries
    .filter((e) => e.zone === 'main' && known[e.cardId]?.category === 'Spell')
    .reduce((sum, e) => sum + e.quantity, 0);
  const trapCount = validation.counts.main - monsterCount - spellCount;
  const demo = !status || status.source === 'demo';
  const categories = [
    { id: '', label: 'Toutes' },
    { id: 'Monster', label: 'Monstres' },
    { id: 'Spell', label: 'Magies' },
    { id: 'Trap', label: 'Pièges' },
  ];
  const showInspector = (id: number) => {
    setSelected(id);
    setInspectorOpen(true);
  };

  return (
    <div className="app-shell" inert={!ready} aria-busy={!ready}>
      <aside className="rail" aria-label="Navigation rapide">
        <a href="/" className="brand-mark" aria-label="YGH Companion">
          <Layers3 size={24} />
        </a>
        <div className="rail-nav">
          {[
            { id: 'builder', icon: Layers3, label: 'Deck builder' },
            { id: 'catalog', icon: BookOpen, label: 'Catalogue' },
            { id: 'decks', icon: FolderOpen, label: 'Mes decks' },
            { id: 'analysis', icon: Activity, label: 'Analyse' },
          ].map((item) => (
            <button
              key={item.id}
              title={item.label}
              aria-label={item.label}
              className={view === item.id ? 'rail-active' : ''}
              onClick={() => setView(item.id as View)}
            >
              <item.icon size={21} />
            </button>
          ))}
        </div>
        <button
          className="rail-help"
          title="Aide"
          aria-label="Aide"
          onClick={() => setModal('help')}
        >
          <CircleHelp size={21} />
        </button>
        <span className="avatar" title="Espace local">
          Y
        </span>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="wordmark">
            YGH<span>COMPANION</span>
            <span className="beta">MVP</span>
          </div>
          <nav aria-label="Navigation principale">
            {[
              { id: 'builder', label: 'Deck Studio' },
              { id: 'catalog', label: 'Catalogue' },
              { id: 'decks', label: 'Mes decks' },
              { id: 'analysis', label: 'Analyse' },
            ].map((item) => (
              <button
                key={item.id}
                className={view === item.id ? 'nav-active' : ''}
                onClick={() => setView(item.id as View)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button className="catalog-status" onClick={() => setModal('catalog')}>
            <span className={`status-dot ${demo ? 'amber' : ''}`} />
            {demo ? 'Catalogue démo' : 'Catalogue synchronisé'}
            <ChevronDown size={13} />
          </button>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-line" /> VOTRE TERRAIN DE CRÉATION
              </div>
              <h1>
                {view === 'builder'
                  ? 'De bonnes cartes.'
                  : view === 'catalog'
                    ? 'Explorez les possibilités.'
                    : view === 'decks'
                      ? 'Vos idées prennent forme.'
                      : 'Jouez les probabilités.'}{' '}
                {view === 'builder' && <span>Un meilleur deck.</span>}
              </h1>
              <p>
                {view === 'builder'
                  ? 'Construisez, ajustez, testez. Votre prochaine stratégie commence ici.'
                  : view === 'catalog'
                    ? 'Une carte, une interaction, une nouvelle façon de jouer.'
                    : view === 'decks'
                      ? 'Retrouvez vos constructions et préparez votre prochain duel.'
                      : 'Des calculs précis pour prendre de meilleures décisions.'}
              </p>
            </div>
            <button className="button primary heading-action" onClick={newDeck}>
              <Plus size={16} /> Nouveau deck
            </button>
          </section>
          <div className="workspace-meta">
            <div>
              <span className="live-dot" /> ESPACE DE TRAVAIL{' '}
              <span className="meta-divider">/</span>
              <span className="muted">
                {view === 'builder'
                  ? 'Deck builder'
                  : view === 'catalog'
                    ? 'Card database'
                    : view === 'decks'
                      ? 'Bibliothèque locale'
                      : 'Laboratoire'}
              </span>
            </div>
            <span className="format-label">
              <ShieldCheck size={13} /> FORMAT TCG <span>•</span>{' '}
              {demo ? 'RÈGLES DÉMO' : 'RESTRICTIONS FOURNISSEUR'}
            </span>
          </div>

          {(view === 'builder' || view === 'catalog') && (
            <div className={`studio-grid ${view === 'catalog' ? 'catalog-view' : ''}`}>
              <section className="panel catalog-panel" aria-label="Catalogue de cartes">
                <div className="panel-heading">
                  <div>
                    <h2>
                      <BookOpen size={17} /> Card explorer
                    </h2>
                    <span className="panel-subtitle">Trouvez la pièce manquante.</span>
                  </div>
                  <button
                    className="icon-button"
                    title="Synchroniser le catalogue"
                    aria-label="Synchroniser le catalogue"
                    onClick={() => setModal('catalog')}
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Rechercher une carte"
                    value={query}
                    placeholder="Nom, effet, mot-clé…"
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                  <span className="search-hint">
                    <Command size={11} />
                  </span>
                  {query && (
                    <button
                      aria-label="Effacer la recherche"
                      onClick={() => {
                        setQuery('');
                        setPage(1);
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="filter-row">
                  <div className="category-tabs">
                    {categories.map((item) => (
                      <button
                        key={item.id}
                        className={category === item.id ? 'selected' : ''}
                        onClick={() => {
                          setCategory(item.id);
                          setPage(1);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <button
                    className={`filter-toggle ${filtersOpen || filtersCount ? 'active' : ''}`}
                    title="Filtres avancés"
                    aria-label="Filtres avancés"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen(!filtersOpen)}
                  >
                    <SlidersHorizontal size={15} />
                    {filtersCount > 0 && <b>{filtersCount}</b>}
                  </button>
                </div>
                {filtersOpen && (
                  <div className="advanced-filters">
                    <label>
                      Attribut
                      <select
                        value={attribute}
                        onChange={(e) => {
                          setAttribute(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">Tous</option>
                        {['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Niveau / Rang / Link
                      <select
                        value={level}
                        onChange={(e) => {
                          setLevel(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">Tous</option>
                        {Array.from({ length: 13 }, (_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="wide-filter">
                      Archétype
                      <select
                        value={archetype}
                        onChange={(e) => {
                          setArchetype(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">Tous les archétypes</option>
                        {result?.archetypes.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <div className="results-meta">
                  <span>
                    {loading
                      ? 'Recherche…'
                      : `${(result?.total || 0).toLocaleString('fr-FR')} cartes`}
                    <span className="muted"> · {demo ? 'sélection démo' : 'catalogue'}</span>
                  </span>
                  {query || category || filtersCount > 0 ? (
                    <button onClick={clearFilters}>Réinitialiser</button>
                  ) : (
                    <LayoutGrid size={13} />
                  )}
                </div>
                {catalogError ? (
                  <div className="empty-state">
                    <TriangleAlert />
                    <p>{catalogError}</p>
                    <button className="button" onClick={() => setRefresh((old) => old + 1)}>
                      Réessayer
                    </button>
                  </div>
                ) : !loading && result?.cards.length === 0 ? (
                  <div className="empty-state">
                    <Search />
                    <h3>Aucune carte trouvée</h3>
                    <p>Essayez un autre nom ou élargissez les filtres.</p>
                    <button className="button" onClick={clearFilters}>
                      Effacer les filtres
                    </button>
                  </div>
                ) : (
                  <div className={`card-grid ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
                    {(result?.cards || []).map((card) => {
                      const count = entries
                        .filter((e) => e.cardId === card.id)
                        .reduce((sum, e) => sum + e.quantity, 0);
                      return (
                        <article
                          key={card.id}
                          className={`catalog-card ${selected === card.id ? 'card-selected' : ''}`}
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData(
                              'application/ygh-card',
                              JSON.stringify({ cardId: card.id }),
                            )
                          }
                        >
                          <button
                            className="art-button"
                            aria-label={`Voir ${card.name}`}
                            onClick={() => showInspector(card.id)}
                          >
                            <CardArt card={card} />
                            {card.limit < 3 && (
                              <span
                                className={`limit-badge limit-${card.limit}`}
                                title={
                                  demo
                                    ? 'Restriction de démonstration'
                                    : 'Restriction TCG du fournisseur'
                                }
                              >
                                {card.limit === 0 ? '⊘' : card.limit}
                              </span>
                            )}
                            {count > 0 && <span className="in-deck-badge">{count}×</span>}
                          </button>
                          <div className="card-caption">
                            <button onClick={() => showInspector(card.id)} title={card.name}>
                              {card.name}
                            </button>
                            <span>
                              {card.category === 'Monster'
                                ? `${card.attribute} · ${card.extra && card.frame === 'link' ? 'LINK' : card.frame === 'xyz' ? 'RANG' : 'NIV.'} ${card.level}`
                                : card.category === 'Spell'
                                  ? 'MAGIE'
                                  : 'PIÈGE'}
                            </span>
                          </div>
                          <button
                            className="quick-add"
                            aria-label={`Ajouter ${card.name}`}
                            onClick={() => addCard(card)}
                          >
                            <Plus size={13} />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
                {result && result.pages > 1 && (
                  <div className="pagination">
                    <button
                      aria-label="Page précédente"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((old) => old - 1)}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span>
                      {result.page} / {result.pages}
                    </span>
                    <button
                      aria-label="Page suivante"
                      disabled={page >= result.pages || loading}
                      onClick={() => setPage((old) => old + 1)}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
                <div className="catalog-footnote">
                  <span className="mini-plus">+</span> Cliquez sur + pour ajouter une carte.
                  <br />
                  <span>Les images sont fournies par YGOPRODeck.</span>
                </div>
              </section>

              {view === 'builder' && (
                <section className="panel deck-panel" aria-label="Éditeur de deck">
                  <div className="deck-heading">
                    <div className="deck-label">
                      <span className="deck-symbol">
                        <Swords size={19} />
                      </span>
                      <div>
                        <span className="eyebrow">DECK EN CONSTRUCTION</span>
                        <input
                          aria-label="Nom du deck"
                          maxLength={100}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Dupliquer le deck"
                      title="Enregistrer une copie"
                      disabled={!!busy}
                      onClick={() => save(true)}
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                  <div className="deck-toolbar">
                    <span className="tag">TCG</span>
                    <span className="draft-indicator">
                      <span className={`status-dot ${dirty ? 'amber' : ''}`} />
                      {dirty ? 'Brouillon local' : 'Enregistré'}
                    </span>
                    <div className="toolbar-actions">
                      <button
                        title="Importer un YDK"
                        aria-label="Importer un YDK"
                        onClick={() => ydkInput.current?.click()}
                      >
                        <Upload size={15} />
                      </button>
                      <button
                        title="Exporter le deck en YDK"
                        aria-label="Exporter le deck en YDK"
                        onClick={() => download(`${name || 'deck'}.ydk`, toYdk(entries))}
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="deck-composition">
                    <div className="composition-bar">
                      <i className="monster" style={{ flex: monsterCount || 0.05 }} />
                      <i className="spell" style={{ flex: spellCount || 0.05 }} />
                      <i className="trap" style={{ flex: trapCount || 0.05 }} />
                    </div>
                    <div>
                      <span>
                        <i className="legend-dot monster" />
                        Monstres <b>{monsterCount}</b>
                      </span>
                      <span>
                        <i className="legend-dot spell" />
                        Magies <b>{spellCount}</b>
                      </span>
                      <span>
                        <i className="legend-dot trap" />
                        Pièges <b>{trapCount}</b>
                      </span>
                    </div>
                  </div>
                  <div className="deck-zones">
                    {zones.map((zone) => (
                      <section
                        key={zone.id}
                        className={`deck-zone ${target === zone.id ? 'zone-target' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => drop(e, zone.id)}
                        aria-label={zone.label}
                      >
                        <div className="zone-heading">
                          <button
                            onClick={() => setTarget(zone.id)}
                            title={`Ajouter les cartes au ${zone.label}`}
                          >
                            <span className={`zone-dot ${zone.id}`} />
                            <h3>{zone.label}</h3>
                            <span className="zone-rule">{zone.subtitle}</span>
                          </button>
                          <span
                            className={`zone-count ${validation.counts[zone.id] > zone.max ? 'over-limit' : ''}`}
                          >
                            {validation.counts[zone.id]}
                            <span> / {zone.max}</span>
                          </span>
                        </div>
                        {entries.some((e) => e.zone === zone.id) ? (
                          <div className="deck-card-grid">
                            {entries
                              .filter((e) => e.zone === zone.id)
                              .map((entry) => {
                                const card = known[entry.cardId];
                                if (!card)
                                  return (
                                    <div key={entry.cardId} className="missing-card">
                                      #{entry.cardId}
                                      <button onClick={() => removeCard(entry.cardId, zone.id)}>
                                        Retirer
                                      </button>
                                    </div>
                                  );
                                return (
                                  <div
                                    className="deck-card"
                                    key={entry.cardId}
                                    draggable
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData(
                                        'application/ygh-card',
                                        JSON.stringify({ cardId: card.id, zone: zone.id }),
                                      )
                                    }
                                  >
                                    <button
                                      className="art-button"
                                      aria-label={`Détails de ${card.name}`}
                                      onClick={() => showInspector(card.id)}
                                    >
                                      <CardArt card={card} />
                                      <span className="quantity-badge">{entry.quantity}×</span>
                                    </button>
                                    <div className="deck-card-controls">
                                      <button
                                        aria-label={`Retirer ${card.name} du ${zone.label}`}
                                        onClick={() => removeCard(card.id, zone.id)}
                                      >
                                        <Minus size={11} />
                                      </button>
                                      <button
                                        aria-label={`Ajouter un exemplaire de ${card.name} au ${zone.label}`}
                                        onClick={() => addCard(card, zone.id)}
                                      >
                                        <Plus size={11} />
                                      </button>
                                    </div>
                                    <span className="deck-card-name" title={card.name}>
                                      {card.name}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <button className="zone-empty" onClick={() => setTarget(zone.id)}>
                            <Plus size={18} />
                            <span>Déposez vos cartes ici</span>
                            <small>ou choisissez cette zone avant l’ajout</small>
                          </button>
                        )}
                      </section>
                    ))}
                  </div>
                  <div className="deck-bottom">
                    <button
                      className={`validation-status ${validation.valid ? 'valid' : ''}`}
                      onClick={() => setModal('validation')}
                    >
                      <ShieldCheck size={16} />
                      <span>
                        {validation.valid
                          ? 'Structure valide'
                          : `${validation.issues.length} point${validation.issues.length > 1 ? 's' : ''} à vérifier`}
                      </span>
                      <ChevronRight size={14} />
                    </button>
                    <button className="button primary" disabled={!!busy} onClick={() => save()}>
                      {busy === 'save' ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <Save size={15} />
                      )}{' '}
                      Enregistrer
                    </button>
                  </div>
                </section>
              )}

              <aside
                className={`panel inspector ${inspectorOpen ? 'inspector-open' : ''}`}
                aria-label="Détails de la carte"
              >
                <div className="inspector-top">
                  <span className="eyebrow">ZOOM SUR UNE CARTE</span>
                  <button
                    className="icon-button mobile-close"
                    aria-label="Fermer la fiche"
                    onClick={() => setInspectorOpen(false)}
                  >
                    <X size={17} />
                  </button>
                  <span className="inspector-cross">↗</span>
                </div>
                {active && (
                  <>
                    <div className="inspector-art">
                      <CardArt key={active.id} card={active} large />
                    </div>
                    <div className="inspector-content">
                      <div className={`card-kind text-${active.category.toLowerCase()}`}>
                        {active.type}
                      </div>
                      <h2>{active.name}</h2>
                      <div className="detail-tags">
                        {active.attribute && <span>{active.attribute}</span>}
                        {active.level !== null && (
                          <span>
                            {active.frame === 'link'
                              ? 'LINK'
                              : active.frame === 'xyz'
                                ? 'RANG'
                                : 'NIVEAU'}{' '}
                            {active.level}
                          </span>
                        )}
                        {active.archetype && <span>{active.archetype}</span>}
                      </div>
                      {active.category === 'Monster' && (
                        <div className="stats">
                          <div>
                            <span>ATK</span>
                            <strong>{active.atk === -1 ? '?' : (active.atk ?? '—')}</strong>
                          </div>
                          <div>
                            <span>DEF</span>
                            <strong>{active.def === -1 ? '?' : (active.def ?? '—')}</strong>
                          </div>
                          <Swords size={18} />
                        </div>
                      )}
                      <div className="effect-heading">
                        {demo ? 'RÉSUMÉ DE DÉMONSTRATION' : 'TEXTE DE LA CARTE'}
                      </div>
                      <p className="effect-text">{active.description}</p>
                      <div className={`restriction ${active.limit === 0 ? 'forbidden' : ''}`}>
                        <ShieldCheck size={14} />
                        <span>
                          {active.limit === 0
                            ? 'Interdite'
                            : active.limit === 1
                              ? 'Limitée à 1'
                              : active.limit === 2
                                ? 'Semi-limitée à 2'
                                : '3 exemplaires maximum'}
                          <small>
                            {demo
                              ? 'Exemple · ne vaut pas banlist officielle'
                              : 'TCG · donnée YGOPRODeck non certifiée'}
                          </small>
                        </span>
                      </div>
                      <button
                        className="button primary inspector-add"
                        onClick={() => addCard(active)}
                      >
                        <Plus size={15} />
                        Ajouter au {target === 'side'
                          ? 'Side'
                          : active.extra
                            ? 'Extra'
                            : 'Main'}{' '}
                        Deck
                      </button>
                      <p className="card-passcode">
                        PASSCODE <span>{active.id.toString().padStart(8, '0')}</span>
                      </p>
                    </div>
                  </>
                )}
              </aside>
            </div>
          )}

          {view === 'decks' && (
            <DeckLibrary
              savedDecks={savedDecks}
              onImport={() => ydkInput.current?.click()}
              onStudio={() => setView('builder')}
              onOpen={loadDeck}
              onDelete={deleteDeck}
              onExport={(deck) => download(`${deck.name}.ydk`, toYdk(deck.entries))}
            />
          )}

          {view === 'analysis' && (
            <AnalysisView
              entries={entries}
              known={known}
              mainCount={validation.counts.main}
              probabilityIds={probabilityIds}
              setProbabilityIds={setProbabilityIds}
            />
          )}

          <footer className="footer">
            <span>
              <Layers3 size={13} /> Conçu pour votre prochain duel.
            </span>
            <span>
              Projet indépendant · Non affilié à Konami <span className="footer-dot">·</span>{' '}
              Données YGOPRODeck
            </span>
            <button onClick={() => setModal('catalog')}>
              État des données <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      <input
        ref={ydkInput}
        className="visually-hidden"
        type="file"
        accept=".ydk"
        aria-label="Fichier deck YDK"
        onChange={(e) => {
          importYdk(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={catalogInput}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        aria-label="Fichier catalogue JSON"
        onChange={(e) => {
          synchronize(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {notice && (
        <div
          role={notice.error ? 'alert' : 'status'}
          className={`toast ${notice.error ? 'toast-error' : ''}`}
        >
          {notice.error ? <TriangleAlert size={18} /> : <Check size={18} />}
          <span>{notice.text}</span>
          <button aria-label="Fermer le message" onClick={() => setNotice(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <Modal
            title={
              modal === 'catalog'
                ? 'Votre catalogue, à jour.'
                : modal === 'validation'
                  ? 'Vérification du deck'
                  : 'Bienvenue dans votre Deck Studio'
            }
            onClose={() => setModal(null)}
          >
            {modal === 'catalog' ? (
              <>
                <div className="modal-icon">
                  <Database size={25} />
                </div>
                <p>
                  Le catalogue est conservé dans la base locale. Un import invalide ne remplace pas
                  les données existantes.
                </p>
                <dl className="data-status">
                  <div>
                    <dt>Source</dt>
                    <dd>
                      {demo
                        ? 'Démonstration hors ligne'
                        : status?.source === 'file'
                          ? 'Fichier JSON importé'
                          : 'YGOPRODeck API'}
                    </dd>
                  </div>
                  <div>
                    <dt>Cartes disponibles</dt>
                    <dd>{status?.count.toLocaleString('fr-FR') || '—'}</dd>
                  </div>
                  <div>
                    <dt>Dernière mise à jour</dt>
                    <dd>{status ? new Date(status.updatedAt).toLocaleString('fr-FR') : '—'}</dd>
                  </div>
                </dl>
                <div className="warning-note">
                  <TriangleAlert size={17} />
                  <p>
                    {demo
                      ? 'Les textes sont des résumés et les restrictions sont illustratives. Synchronisez pour obtenir le catalogue du fournisseur.'
                      : 'Les restrictions proviennent du fournisseur. Leur date d’effet et les règles particulières de noms ou de disponibilité ne sont pas certifiées.'}{' '}
                    Vérifiez toujours la banlist officielle avant un tournoi.
                  </p>
                </div>
                <button
                  className="button primary full-width"
                  disabled={!!busy}
                  onClick={() => synchronize()}
                >
                  {busy === 'sync' ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}{' '}
                  {busy === 'sync' ? 'Synchronisation…' : 'Synchroniser avec YGOPRODeck'}
                </button>
                <button
                  className="button full-width"
                  disabled={!!busy}
                  onClick={() => catalogInput.current?.click()}
                >
                  <Upload size={16} />
                  Importer une réponse JSON YGOPRODeck
                </button>
                <small className="modal-footnote">
                  Accès requis : db.ygoprodeck.com et images.ygoprodeck.com. La synchronisation
                  importe le catalogue anglais ; les images sont chargées directement depuis le
                  fournisseur.
                </small>
              </>
            ) : modal === 'validation' ? (
              <>
                <div className="warning-note">
                  <CircleHelp size={17} />
                  <p>
                    {demo
                      ? 'Mode démonstration : les restrictions ne représentent pas une banlist officielle.'
                      : 'Restrictions du fournisseur : la légalité officielle reste à vérifier.'}{' '}
                    Le contrôle actuel vérifie les quantités, les limites cumulées et les zones.
                  </p>
                </div>
                {validation.issues.length ? (
                  <ul className="issue-list">
                    {validation.issues.map((issue, i) => (
                      <li key={`${issue.code}-${i}`}>
                        <TriangleAlert size={15} />
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="success-note">
                    <ShieldCheck size={20} />
                    Structure du deck valide selon les données chargées.
                  </div>
                )}
                <p className="modal-footnote">
                  Un brouillon incomplet peut être enregistré. Les équivalences de noms, dates de
                  sortie et règles spécifiques de tournoi ne sont pas encore couvertes.
                </p>
              </>
            ) : (
              <>
                <p>
                  Votre espace local pour explorer les cartes et construire vos decks Yu-Gi-Oh!.
                </p>
                <ul className="help-list">
                  <li>
                    <Plus size={17} />
                    <span>
                      Ajoutez des cartes avec le bouton +. Les monstres Fusion, Synchro, Xyz et Link
                      rejoignent automatiquement l’Extra Deck.
                    </span>
                  </li>
                  <li>
                    <Layers3 size={17} />
                    <span>
                      Cliquez sur le titre Side Deck avant l’ajout, ou glissez une carte entre les
                      zones. Dans la fiche, le bouton d’ajout fonctionne aussi au clavier.
                    </span>
                  </li>
                  <li>
                    <Save size={17} />
                    <span>
                      Le brouillon est conservé dans ce navigateur. « Enregistrer » crée une
                      sauvegarde dans la base relationnelle de cet espace.
                    </span>
                  </li>
                  <li>
                    <Activity size={17} />
                    <span>L’onglet Analyse calcule vos probabilités de main de départ.</span>
                  </li>
                </ul>
                <div className="warning-note">
                  <ShieldCheck size={17} />
                  <p>
                    MVP à usage local, sans comptes utilisateurs. Ne l’exposez pas publiquement sans
                    ajouter une authentification et des contrôles d’accès.
                  </p>
                </div>
              </>
            )}
          </Modal>
        </div>
      )}
    </div>
  );
}
