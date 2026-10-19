import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalog } from '../src/lib/catalog';
const card = {
  id: 1,
  name: 'Test Link',
  type: 'Link Monster',
  desc: 'Test effect',
  race: 'Cyberse',
  linkval: 3,
  atk: 2300,
  banlist_info: { ban_tcg: 'Limited' },
  card_images: [
    {
      id: 1,
      image_url: 'https://images.ygoprodeck.com/images/cards/1.jpg',
      image_url_small: 'https://images.ygoprodeck.com/images/cards_small/1.jpg',
    },
  ],
};
test('normalizes restrictions, link ratings, absent DEF and extra deck placement', () => {
  const [result] = normalizeCatalog({ data: [card] });
  assert.equal(result.limit, 1);
  assert.equal(result.level, 3);
  assert.equal(result.def, null);
  assert.equal(result.extra, true);
});
test('rejects empty, duplicate, invalid or unsafe provider data', () => {
  assert.throws(() => normalizeCatalog({ data: [] }));
  assert.throws(() => normalizeCatalog({ data: [card, card] }));
  assert.throws(() => normalizeCatalog({ data: [{ ...card, id: 'bad' }] }));
  assert.throws(() =>
    normalizeCatalog({
      data: [
        {
          ...card,
          card_images: [
            { id: 1, image_url: 'http://evil.test/1', image_url_small: 'http://evil.test/1' },
          ],
        },
      ],
    }),
  );
});
test('excludes tokens and skills and defaults unlisted restrictions to three', () => {
  const cards = normalizeCatalog({
    data: [
      { ...card, type: 'Token', id: 2 },
      { ...card, type: 'Skill Card', id: 3 },
      { ...card, banlist_info: undefined },
    ],
  });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].limit, 3);
});

test('accepts nullable provider metadata without inventing zero statistics', () => {
  const [result] = normalizeCatalog({
    data: [
      {
        ...card,
        level: null,
        linkval: null,
        atk: null,
        def: null,
        attribute: null,
        archetype: null,
        race: null,
        frameType: null,
        banlist_info: null,
      },
    ],
  });
  assert.equal(result.level, null);
  assert.equal(result.atk, null);
  assert.equal(result.def, null);
  assert.equal(result.attribute, null);
  assert.equal(result.archetype, null);
  assert.equal(result.race, '');
  assert.equal(result.limit, 3);
});
test('accepts integer strings and preserves actual zero and unknown-stat sentinels', () => {
  const [result] = normalizeCatalog({
    data: [{ ...card, level: '7', linkval: null, atk: '0', def: '-1' }],
  });
  assert.equal(result.level, 7);
  assert.equal(result.atk, 0);
  assert.equal(result.def, -1);
  const [link] = normalizeCatalog({ data: [{ ...card, level: null, linkval: '3' }] });
  assert.equal(link.level, 3);
});
test('rejects malformed numeric metadata instead of silently coercing it', () => {
  for (const value of ['', ' ', 'seven', '3.5', true, {}, 3.5]) {
    assert.throws(() => normalizeCatalog({ data: [{ ...card, level: value }] }));
  }
});
