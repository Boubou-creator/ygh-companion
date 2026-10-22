import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cardsByIds, ConflictError, listDecks, saveDeck } from '@/lib/db';
import { validateDeck } from '@/lib/rules';
import { limitedJson, mutationGuard } from '@/lib/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100),
  entries: z
    .array(
      z.object({
        cardId: z.number().int().positive(),
        zone: z.enum(['main', 'extra', 'side']),
        quantity: z.number().int().min(1).max(120),
      }),
    )
    .max(120),
});
export async function GET() {
  return NextResponse.json({ decks: listDecks() });
}
export async function POST(request: Request) {
  const denied = mutationGuard(request);
  if (denied) return denied;
  try {
    const input = schema.parse(await limitedJson(request));
    if (input.entries.reduce((sum, e) => sum + e.quantity, 0) > 120)
      throw new Error('120 cartes maximum par brouillon.');
    if (new Set(input.entries.map((e) => `${e.zone}-${e.cardId}`)).size !== input.entries.length)
      throw new Error('Entrées de cartes dupliquées.');
    const cards = cardsByIds(input.entries.map((e) => e.cardId));
    if (new Set(input.entries.map((e) => e.cardId)).size !== cards.length)
      throw new Error('Le deck contient une carte inconnue.');
    const deck = saveDeck(input);
    return NextResponse.json({ deck, validation: validateDeck(deck.entries, cards) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? 'Nom ou contenu du deck invalide.'
            : error instanceof Error
              ? error.message
              : 'Sauvegarde impossible.',
      },
      { status: error instanceof ConflictError ? 409 : 400 },
    );
  }
}
