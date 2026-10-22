import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { demoCards } from './seed';
import type { Card, CatalogStatus, Deck, Entry } from './types';
let instance: DatabaseSync | undefined;
export function db() {
  if (instance) return instance;
  const path = resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH || '.data/companion.sqlite',
  );
  mkdirSync(dirname(path), { recursive: true });
  instance = new DatabaseSync(path);
  instance.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, attribute TEXT, level INTEGER, archetype TEXT, description TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS cards_category ON cards(category);
 CREATE INDEX IF NOT EXISTS cards_archetype ON cards(archetype);
 CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS deck_entries (deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE, card_id INTEGER NOT NULL REFERENCES cards(id), zone TEXT NOT NULL CHECK(zone IN ('main','extra','side')), quantity INTEGER NOT NULL CHECK(quantity > 0), PRIMARY KEY(deck_id, card_id, zone));
 CREATE TABLE IF NOT EXISTS import_runs (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, source TEXT NOT NULL, count INTEGER NOT NULL, status TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS banlist_versions (id TEXT PRIMARY KEY, imported_at TEXT NOT NULL, source TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'TCG', effective_at TEXT, verified INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS banlist_entries (version_id TEXT NOT NULL REFERENCES banlist_versions(id), card_id INTEGER NOT NULL REFERENCES cards(id), max_copies INTEGER NOT NULL CHECK(max_copies BETWEEN 0 AND 3), PRIMARY KEY(version_id,card_id));`);
  if (!instance.prepare('SELECT id FROM cards LIMIT 1').get()) replaceCatalog(demoCards, 'demo');
  return instance;
}
export function replaceCatalog(cards: Card[], source: CatalogStatus['source']) {
  if (!cards.length) throw new Error('Le catalogue est vide.');
  const conn = db();
  conn.exec('BEGIN IMMEDIATE');
  try {
    conn.exec('UPDATE cards SET active=0');
    const statement = conn.prepare(
      `INSERT INTO cards(id,name,category,attribute,level,archetype,description,active,payload) VALUES(?,?,?,?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,attribute=excluded.attribute,level=excluded.level,archetype=excluded.archetype,description=excluded.description,active=1,payload=excluded.payload`,
    );
    for (const card of cards)
      statement.run(
        card.id,
        card.name,
        card.category,
        card.attribute,
        card.level,
        card.archetype,
        card.description,
        JSON.stringify(card),
      );
    const now = new Date().toISOString();
    const banlistVersion = crypto.randomUUID();
    conn
      .prepare('INSERT INTO banlist_versions(id,imported_at,source) VALUES(?,?,?)')
      .run(banlistVersion, now, source);
    const restriction = conn.prepare(
      'INSERT INTO banlist_entries(version_id,card_id,max_copies) VALUES(?,?,?)',
    );
    for (const card of cards)
      if (card.limit < 3) restriction.run(banlistVersion, card.id, card.limit);
    const status: CatalogStatus = {
      source,
      count: cards.length,
      updatedAt: now,
      banlistVersion,
      banlist:
        source === 'demo'
          ? 'Restrictions de démonstration'
          : 'Restrictions TCG YGOPRODeck · date d’effet non certifiée',
    };
    conn
      .prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)')
      .run('catalog', JSON.stringify(status));
    conn
      .prepare('INSERT INTO import_runs(created_at,source,count,status) VALUES(?,?,?,?)')
      .run(now, source, cards.length, 'success');
    conn.exec('COMMIT');
    return status;
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}
export function catalogStatus(): CatalogStatus {
  return JSON.parse(
    db().prepare('SELECT value FROM metadata WHERE key=?').get('catalog')!.value as string,
  );
}
export function cardsByIds(ids: number[]): Card[] {
  if (!ids.length) return [];
  return db()
    .prepare(`SELECT payload FROM cards WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids)
    .map((row) => JSON.parse(row.payload as string));
}
export function listDecks(): Deck[] {
  return db()
    .prepare('SELECT * FROM decks ORDER BY updated_at DESC')
    .all()
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      version: row.version as number,
      updatedAt: row.updated_at as string,
      entries: db()
        .prepare('SELECT card_id AS cardId, zone, quantity FROM deck_entries WHERE deck_id=?')
        .all(row.id as string) as unknown as Entry[],
    }));
}
export class ConflictError extends Error {}
export function saveDeck(input: {
  id?: string;
  name: string;
  version?: number;
  entries: Entry[];
}): Deck {
  const conn = db(),
    id = input.id || crypto.randomUUID(),
    now = new Date().toISOString();
  conn.exec('BEGIN IMMEDIATE');
  try {
    const current = conn.prepare('SELECT version FROM decks WHERE id=?').get(id);
    if (input.id && !current)
      throw new ConflictError('Ce deck n’existe plus. Enregistrez-le comme nouveau deck.');
    if (current && current.version !== input.version)
      throw new ConflictError('Ce deck a été modifié ailleurs. Rechargez-le avant de sauvegarder.');
    const version = Number(current?.version || 0) + 1;
    conn
      .prepare(
        'INSERT INTO decks(id,name,version,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,version=excluded.version,updated_at=excluded.updated_at',
      )
      .run(id, input.name, version, now);
    conn.prepare('DELETE FROM deck_entries WHERE deck_id=?').run(id);
    const insert = conn.prepare(
      'INSERT INTO deck_entries(deck_id,card_id,zone,quantity) VALUES(?,?,?,?)',
    );
    for (const entry of input.entries) insert.run(id, entry.cardId, entry.zone, entry.quantity);
    conn.exec('COMMIT');
    return { id, name: input.name, version, updatedAt: now, entries: input.entries };
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}
