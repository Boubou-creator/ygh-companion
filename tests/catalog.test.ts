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
