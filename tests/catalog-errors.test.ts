import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  CatalogSyncError,
  describeCatalogFailure,
  providerHttpError,
} from '../src/lib/catalog-errors';

test('reports DNS, TLS, timeout and connection errors from nested fetch causes', () => {
  for (const [cause, expected] of [
    ['ENOTFOUND', 'NETWORK_DNS'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'NETWORK_TLS'],
    ['ETIMEDOUT', 'NETWORK_TIMEOUT'],
    ['ECONNRESET', 'NETWORK_CONNECTION'],
  ]) {
    const error = new TypeError('fetch failed', {
      cause: Object.assign(new Error('private error'), { code: cause }),
    });
    const failure = describeCatalogFailure(error, false);
    assert.equal(failure.code, expected);
    assert.equal(failure.status, 502);
    assert.ok(failure.error.includes('catalogue actuel est conservé'));
    assert.ok(!failure.error.includes('private error'));
  }
  const timeout = describeCatalogFailure(new DOMException('expired', 'TimeoutError'), false);
  assert.equal(timeout.code, 'NETWORK_TIMEOUT');
});
test('recognizes aggregate connection failures on Windows', () => {
  const error = new TypeError('fetch failed', {
    cause: new AggregateError([
      Object.assign(new Error(), { code: 'ECONNREFUSED' }),
      Object.assign(new Error(), { code: 'ENETUNREACH' }),
    ]),
  });
  assert.equal(describeCatalogFailure(error, false).code, 'NETWORK_CONNECTION');
});
test('schema and JSON failures are not presented as a connection failure', () => {
  const invalid = z
    .object({ data: z.array(z.object({ name: z.string() })) })
    .safeParse({ data: [{ name: 42 }] });
  assert.equal(invalid.success, false);
  if (invalid.success) return;
  const failure = describeCatalogFailure(invalid.error, false);
  assert.equal(failure.status, 422);
  assert.equal(failure.code, 'CATALOG_SCHEMA');
  assert.ok(failure.error.includes('data.0.name'));
  assert.equal(describeCatalogFailure(invalid.error, true).status, 400);
  assert.equal(
    describeCatalogFailure(new SyntaxError('private response'), false).code,
    'CATALOG_JSON',
  );
});
test('reports provider status and rate limiting without exposing raw error details', () => {
  const failure = describeCatalogFailure(providerHttpError(429), false);
  assert.equal(failure.code, 'PROVIDER_HTTP_429');
  assert.ok(failure.error.includes('attendez'));
  assert.ok(describeCatalogFailure(providerHttpError(403), false).error.includes('Accès refusé'));
  const unknown = describeCatalogFailure(new Error('https://user:secret@proxy.test'), false);
  assert.equal(unknown.status, 500);
  assert.ok(!unknown.error.includes('secret'));
});
test('preserves catalog safety errors and identifies incomplete responses', () => {
  const failure = describeCatalogFailure(
    new CatalogSyncError('CATALOG_INCOMPLETE', 'Réponse incomplète.'),
    false,
  );
  assert.equal(failure.status, 422);
  assert.equal(failure.code, 'CATALOG_INCOMPLETE');
});
