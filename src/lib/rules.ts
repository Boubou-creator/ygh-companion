import type { Card, Entry, Zone } from './types';
export interface Issue {
  code: string;
  message: string;
  cardId?: number;
}
export function validateDeck(entries: Entry[], cards: Card[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const counts: Record<Zone, number> = { main: 0, extra: 0, side: 0 };
  const copies = new Map<number, number>();
  const issues: Issue[] = [];
  for (const entry of entries) {
    counts[entry.zone] += entry.quantity;
    copies.set(entry.cardId, (copies.get(entry.cardId) || 0) + entry.quantity);
    const card = byId.get(entry.cardId);
    if (!card) {
      issues.push({
        code: 'UNKNOWN_CARD',
        message: `Carte ${entry.cardId} absente du catalogue.`,
        cardId: entry.cardId,
      });
      continue;
    }
    if (entry.zone !== 'side' && card.extra !== (entry.zone === 'extra'))
      issues.push({
        code: 'WRONG_ZONE',
        message: `${card.name} doit être placé dans le ${card.extra ? 'Extra' : 'Main'} Deck.`,
        cardId: card.id,
      });
  }
  if (counts.main < 40 || counts.main > 60)
    issues.push({
      code: 'MAIN_SIZE',
      message: `Main Deck : ${counts.main} cartes, entre 40 et 60 requises.`,
    });
  if (counts.extra > 15)
    issues.push({ code: 'EXTRA_SIZE', message: 'Extra Deck : 15 cartes maximum.' });
  if (counts.side > 15)
    issues.push({ code: 'SIDE_SIZE', message: 'Side Deck : 15 cartes maximum.' });
  for (const [id, quantity] of copies) {
    const card = byId.get(id);
    if (card && quantity > card.limit)
      issues.push({
        code: 'COPY_LIMIT',
        message: `${card.name} : ${quantity} exemplaire(s), ${card.limit} autorisé(s) au total.`,
        cardId: id,
      });
  }
  return { counts, issues, valid: issues.length === 0 };
}
// Exact probability of at least one success in a hand, without replacement.
export function openingProbability(deckSize: number, successes: number, handSize = 5): number {
  if (
    !Number.isInteger(deckSize) ||
    !Number.isInteger(successes) ||
    !Number.isInteger(handSize) ||
    deckSize < 1 ||
    successes < 0 ||
    successes > deckSize ||
    handSize < 0 ||
    handSize > deckSize
  )
    return 0;
  let miss = 1;
  for (let i = 0; i < handSize; i++) miss *= Math.max(0, deckSize - successes - i) / (deckSize - i);
  return 1 - miss;
}
export function toYdk(entries: Entry[]): string {
  const section = (zone: Zone) =>
    entries
      .filter((e) => e.zone === zone)
      .flatMap((e) => Array(e.quantity).fill(String(e.cardId)))
      .join('\n');
  return `#created by YGH Companion\n#main\n${section('main')}\n#extra\n${section('extra')}\n!side\n${section('side')}\n`;
}
export function parseYdk(text: string): Entry[] {
  let zone: Zone = 'main';
  const entries = new Map<string, Entry>();
  let total = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '#main') zone = 'main';
    else if (line === '#extra') zone = 'extra';
    else if (line === '!side') zone = 'side';
    else if (!line || line.startsWith('#')) continue;
    else {
      if (!/^\d{1,10}$/.test(line) || Number(line) < 1)
        throw new Error(`Ligne YDK invalide : ${line.slice(0, 40)}`);
      if (++total > 120) throw new Error('Import limité à 120 cartes.');
      const cardId = Number(line),
        key = `${zone}-${cardId}`;
      const old = entries.get(key);
      entries.set(key, { cardId, zone, quantity: (old?.quantity || 0) + 1 });
    }
  }
  if (!total) throw new Error('Ce fichier ne contient aucune carte.');
  return [...entries.values()];
}
