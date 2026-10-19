import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cardsByIds,
  catalogStatus,
  ConflictError,
  db,
  listDecks,
  replaceCatalog,
  saveDeck,
} from '../src/lib/db';
import { demoCards } from '../src/lib/seed';
const dir = mkdtempSync(join(tmpdir(), 'ygh-db-'));
process.env.DATABASE_PATH = join(dir, 'test.sqlite');
test('database: idempotent import, preserved deck references, optimistic locking and rollback', () => {
  try {
    assert.equal(catalogStatus().source, 'demo');
    const originalCount = Number(db().prepare('SELECT count(*) AS n FROM cards').get()!.n);
    const previousBanlist = catalogStatus().banlistVersion;
    replaceCatalog(demoCards, 'demo');
    assert.notEqual(catalogStatus().banlistVersion, previousBanlist);
    assert.equal(Number(db().prepare('SELECT count(*) AS n FROM banlist_versions').get()!.n), 2);
    assert.equal(
      db()
        .prepare('SELECT verified FROM banlist_versions WHERE id=?')
        .get(catalogStatus().banlistVersion!)!.verified,
      0,
    );
    assert.equal(Number(db().prepare('SELECT count(*) AS n FROM cards').get()!.n), originalCount);
    const first = saveDeck({
      name: 'My deck',
      entries: [{ cardId: 46986414, zone: 'main', quantity: 3 }],
    });
    assert.equal(first.version, 1);
    assert.equal(listDecks().length, 1);
    const updated = saveDeck({ ...first, name: 'Updated' });
    assert.equal(updated.version, 2);
    assert.throws(() => saveDeck({ ...first, name: 'Stale' }), ConflictError);
    assert.equal(listDecks()[0].name, 'Updated');
    replaceCatalog(
      demoCards.filter((card) => card.id !== 46986414),
      'file',
    );
    assert.equal(cardsByIds([46986414]).length, 1); // existing decks remain readable
    assert.equal(db().prepare('SELECT active FROM cards WHERE id=?').get(46986414)!.active, 0);
    const before = catalogStatus();
    assert.throws(() => replaceCatalog([{ ...demoCards[0], name: null } as never], 'file'));
    assert.deepEqual(catalogStatus(), before); // failed transaction retains previous active catalog
    assert.equal(listDecks()[0].entries[0].cardId, 46986414);
    assert.throws(() =>
      saveDeck({ name: 'Bad', entries: [{ cardId: 999999999, zone: 'main', quantity: 1 }] }),
    );
    assert.equal(listDecks().length, 1);
  } finally {
    db().close();
    rmSync(dir, { recursive: true, force: true });
  }
});
