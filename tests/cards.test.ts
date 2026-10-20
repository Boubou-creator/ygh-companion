import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET } from '../src/app/api/cards/route';
import { db, replaceCatalog } from '../src/lib/db';
import { demoCards } from '../src/lib/seed';
import type { Card, CatalogResponse } from '../src/lib/types';

const dir = mkdtempSync(join(tmpdir(), 'ygh-card-filters-'));
process.env.DATABASE_PATH = join(dir, 'test.sqlite');

async function search(query = ''): Promise<CatalogResponse> {
  const response = await GET(new Request(`http://localhost/api/cards?${query}`));
  assert.equal(response.status, 200);
  return response.json();
}

test('card filters combine monster type and inclusive, open-ended stat ranges before pagination', async () => {
  try {
    const monster = (id: number, overrides: Partial<Card> = {}): Card => ({
      ...demoCards[0],
      id,
      name: `Machine ${String(id).padStart(3, '0')}`,
      category: 'Monster',
      race: 'Machine',
      attribute: 'EARTH',
      atk: 1500,
      def: 1000,
      ...overrides,
    });
    replaceCatalog(
      [
        ...Array.from({ length: 35 }, (_, i) => monster(i + 1)),
        monster(36, { race: 'Beast' }),
        monster(37, { atk: 0, def: 0 }),
        monster(38, { atk: -1, def: -1 }),
        monster(39, { atk: null, def: null }),
        monster(40, { def: null, type: 'Link Monster' }),
        monster(41, { category: 'Spell', race: 'Normal', atk: null, def: null }),
        monster(42, { race: 'Dragon' }),
      ],
      'file',
    );

    const filtered = await search(
      'race=Machine&attribute=EARTH&atkMin=1500&atkMax=1500&defMin=1000&defMax=1000&page=2',
    );
    assert.equal(filtered.total, 35);
    assert.equal(filtered.pages, 2);
    assert.equal(filtered.cards.length, 5);
    assert.deepEqual(filtered.races, ['Beast', 'Dragon', 'Machine']);
    assert.equal((await search('race=Beast')).cards[0].id, 36);
    assert.equal((await search('atkMax=0')).cards[0].id, 37);
    assert.equal((await search('defMax=0')).total, 1);
    assert.equal((await search('atkMin=1500')).total, 38);
    assert.equal((await search('defMin=0')).total, 38);
    assert.equal((await search('atkMin=2000&atkMax=1000')).total, 0);
    assert.equal((await search('category=Spell&race=Machine')).total, 0);
    assert.equal((await search('race=Machine%27%20OR%201=1--')).total, 0);
    assert.equal((await search()).total, 42);

    for (const value of ['-1', '1.5', 'invalid', '9007199254740992']) {
      const response = await GET(new Request(`http://localhost/api/cards?atkMin=${value}`));
      assert.equal(response.status, 400);
    }

    replaceCatalog([monster(1, { race: 'Beast' })], 'file');
    assert.deepEqual((await search()).races, ['Beast']);
    assert.equal((await search('race=Machine')).total, 0);
  } finally {
    db().close();
    rmSync(dir, { recursive: true, force: true });
  }
});
