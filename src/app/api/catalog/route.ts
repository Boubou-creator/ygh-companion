import { NextResponse } from 'next/server';
import { normalizeCatalog } from '@/lib/catalog';
import { catalogStatus, replaceCatalog } from '@/lib/db';
import { limitedJson, mutationGuard } from '@/lib/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(catalogStatus());
}
let syncing = false;
export async function POST(request: Request) {
  const denied = mutationGuard(request);
  if (denied) return denied;
  if (syncing)
    return NextResponse.json({ error: 'Une synchronisation est déjà en cours.' }, { status: 409 });
  syncing = true;
  try {
    const action = new URL(request.url).searchParams.get('action');
    let data: unknown;
    if (action === 'import') data = await limitedJson(request, 30_000_000);
    else {
      const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php', {
        signal: AbortSignal.timeout(60_000),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`YGOPRODeck répond HTTP ${response.status}.`);
      data = await response.json();
    }
    const cards = normalizeCatalog(data);
    if (action !== 'import' && cards.length < 1000)
      throw new Error('Réponse incomplète : le catalogue actuel est conservé.');
    const current = catalogStatus();
    if (current.source !== 'demo' && cards.length < current.count * 0.9)
      throw new Error('Baisse de plus de 10 % du catalogue : import refusé par sécurité.');
    return NextResponse.json(replaceCatalog(cards, action === 'import' ? 'file' : 'ygoprodeck'));
  } catch (error) {
    const isImport = new URL(request.url).searchParams.get('action') === 'import';
    return NextResponse.json(
      {
        error: isImport
          ? 'Import refusé : fichier YGOPRODeck invalide, trop volumineux ou incomplet. Le catalogue est conservé.'
          : 'Synchronisation indisponible. Vérifiez l’accès à db.ygoprodeck.com ou importez un fichier JSON YGOPRODeck. Le catalogue est conservé.',
        detail:
          error instanceof Error && !error.message.includes('[')
            ? error.message.slice(0, 250)
            : undefined,
      },
      { status: isImport ? 400 : 502 },
    );
  } finally {
    syncing = false;
  }
}
