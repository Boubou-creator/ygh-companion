import { NextResponse } from 'next/server';
export function mutationGuard(request: Request) {
  const origin = request.headers.get('origin');
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin && new URL(origin).host !== request.headers.get('host'))
  )
    return NextResponse.json({ error: 'Requête externe refusée.' }, { status: 403 });
  return null;
}
export async function limitedJson(request: Request, max = 100_000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Corps de requête absent.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error('Fichier ou requête trop volumineux.');
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(buffer));
}
