import { NextResponse } from 'next/server';
import { db, catalogStatus, cardsByIds } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ids = params.get('ids');
  if (ids)
    return NextResponse.json({
      cards: cardsByIds(ids.split(',').slice(0, 120).map(Number).filter(Number.isSafeInteger)),
    });
  const clauses = ['active=1'],
    args: (string | number)[] = [];
  const search = params.get('q')?.trim().slice(0, 200);
  if (search) {
    clauses.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
    const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    args.push(term, term);
  }
  for (const key of ['category', 'attribute', 'archetype'] as const)
    if (params.get(key)) {
      clauses.push(`${key}=?`);
      args.push(params.get(key)!);
    }
  if (params.get('level')) {
    clauses.push('level=?');
    args.push(Number(params.get('level')));
  }
  const where = clauses.join(' AND '),
    conn = db();
  const total = Number(
    conn.prepare(`SELECT COUNT(*) AS count FROM cards WHERE ${where}`).get(...args)!.count,
  );
  const pages = Math.max(1, Math.ceil(total / 30)),
    page = Math.max(1, Math.min(pages, Math.floor(Number(params.get('page')) || 1)));
  const cards = conn
    .prepare(
      `SELECT payload FROM cards WHERE ${where} ORDER BY name COLLATE NOCASE,id LIMIT 30 OFFSET ?`,
    )
    .all(...args, (page - 1) * 30)
    .map((row) => JSON.parse(row.payload as string));
  const archetypes = conn
    .prepare(
      'SELECT DISTINCT archetype FROM cards WHERE active=1 AND archetype IS NOT NULL ORDER BY archetype',
    )
    .all()
    .map((row) => row.archetype);
  return NextResponse.json({ cards, total, page, pages, archetypes, status: catalogStatus() });
}
