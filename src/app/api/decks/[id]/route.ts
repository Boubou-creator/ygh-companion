import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mutationGuard } from '@/lib/http';
export const runtime = 'nodejs';
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = mutationGuard(request);
  if (denied) return denied;
  const { id } = await params;
  const result = db().prepare('DELETE FROM decks WHERE id=?').run(id);
  return NextResponse.json({ deleted: result.changes > 0 });
}
