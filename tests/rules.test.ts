import test from 'node:test';
import assert from 'node:assert/strict';
import { openingProbability, parseYdk, toYdk, validateDeck } from '../src/lib/rules';
import { demoCards } from '../src/lib/seed';
import type { Entry } from '../src/lib/types';
test('counts restrictions across main, extra and side', () => {
  const result = validateDeck(
    [
      { cardId: 83764718, zone: 'main', quantity: 1 },
      { cardId: 83764718, zone: 'side', quantity: 1 },
    ],
    demoCards,
  );
  assert.ok(
    result.issues.some((issue) => issue.code === 'COPY_LIMIT' && issue.cardId === 83764718),
  );
});
test('detects forbidden cards, unknown cards, wrong zones and sizes', () => {
  const result = validateDeck(
    [
      { cardId: 55144522, zone: 'main', quantity: 1 },
      { cardId: 50237654, zone: 'main', quantity: 1 },
      { cardId: 999, zone: 'side', quantity: 1 },
      { cardId: 46986414, zone: 'extra', quantity: 16 },
    ],
    demoCards,
  );
  for (const code of ['COPY_LIMIT', 'UNKNOWN_CARD', 'WRONG_ZONE', 'MAIN_SIZE', 'EXTRA_SIZE'])
    assert.ok(
      result.issues.some((issue) => issue.code === code),
      code,
    );
});
test('accepts a structural 40-card deck and allows extra monsters in the side', () => {
  const main = demoCards.filter((card) => !card.extra && card.limit === 3).slice(0, 14);
  const entries: Entry[] = main.map((card, index) => ({
    cardId: card.id,
    zone: 'main',
    quantity: index === 13 ? 1 : 3,
  }));
  entries.push({ cardId: 50237654, zone: 'side', quantity: 2 });
  assert.equal(validateDeck(entries, demoCards).valid, true);
});
test('enforces the 60/15/15 boundaries', () => {
  const result = validateDeck(
    [
      { cardId: 46986414, zone: 'main', quantity: 61 },
      { cardId: 50237654, zone: 'extra', quantity: 16 },
      { cardId: 97268402, zone: 'side', quantity: 16 },
    ],
    demoCards,
  );
  for (const code of ['MAIN_SIZE', 'EXTRA_SIZE', 'SIDE_SIZE'])
    assert.ok(result.issues.some((issue) => issue.code === code));
});
test('YDK round-trip preserves quantities and zones', () => {
  const entries: Entry[] = [
    { cardId: 46986414, zone: 'main', quantity: 3 },
    { cardId: 50237654, zone: 'extra', quantity: 2 },
    { cardId: 14558127, zone: 'side', quantity: 1 },
  ];
  assert.deepEqual(parseYdk(toYdk(entries)), entries);
  assert.throws(() => parseYdk('#main\n<script>'));
  assert.throws(() => parseYdk('#main\n'));
  assert.throws(() => parseYdk('#main\n' + Array(121).fill('46986414').join('\n')));
});
test('opening probabilities match exact hypergeometric calculations', () => {
  assert.ok(Math.abs(openingProbability(40, 3) - 0.3375506073) < 1e-9);
  assert.equal(openingProbability(40, 0), 0);
  assert.equal(openingProbability(40, 40), 1);
  assert.equal(openingProbability(4, 3), 0);
  assert.equal(openingProbability(40, 41), 0);
});
