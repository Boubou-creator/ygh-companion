import { ZodError } from 'zod';

/** Public messages never include raw network errors, proxy URLs, or response bodies. */
export class CatalogSyncError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = 'CatalogSyncError';
  }
}

export function providerHttpError(status: number) {
  const action =
    status === 429
      ? 'Limite de requêtes atteinte : attendez avant de réessayer.'
      : status === 403
        ? 'Accès refusé par le fournisseur ou le proxy réseau.'
        : 'Le fournisseur est indisponible. Réessayez plus tard.';
  return new CatalogSyncError(
    `PROVIDER_HTTP_${status}`,
    `YGOPRODeck répond HTTP ${status}. ${action}`,
    502,
  );
}

function networkCodes(error: unknown, depth = 0): string[] {
  if (!error || typeof error !== 'object' || depth > 5) return [];
  const value = error as { code?: unknown; cause?: unknown; errors?: unknown };
  return [
    ...(typeof value.code === 'string' ? [value.code] : []),
    ...networkCodes(value.cause, depth + 1),
    ...(Array.isArray(value.errors)
      ? value.errors.flatMap((item) => networkCodes(item, depth + 1))
      : []),
  ];
}

export function describeCatalogFailure(error: unknown, isImport: boolean) {
  let code: string, message: string, status: number;
  if (error instanceof CatalogSyncError) {
    ({ code, message, status } = error);
  } else if (error instanceof ZodError) {
    // Only the schema path is exposed, never the rejected data or raw provider payload.
    const path = error.issues[0]?.path.map(String).join('.') || 'data';
    code = 'CATALOG_SCHEMA';
    status = isImport ? 400 : 422;
    message = `Le ${isImport ? 'fichier' : 'catalogue reçu de YGOPRODeck'} est incompatible avec l’import : champ ${path}. Ce n’est pas une erreur de connexion.`;
  } else if (error instanceof SyntaxError) {
    code = 'CATALOG_JSON';
    status = isImport ? 400 : 502;
    message = isImport
      ? 'Le fichier n’est pas un JSON valide.'
      : 'YGOPRODeck a renvoyé une réponse qui n’est pas un JSON valide.';
  } else {
    const codes = networkCodes(error);
    status = 502;
    if (
      codes.some((value) =>
        [
          'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
          'SELF_SIGNED_CERT_IN_CHAIN',
          'DEPTH_ZERO_SELF_SIGNED_CERT',
          'CERT_HAS_EXPIRED',
          'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
        ].includes(value),
      )
    ) {
      code = 'NETWORK_TLS';
      message =
        'Node.js ne peut pas vérifier le certificat HTTPS de YGOPRODeck. Vérifiez les certificats de votre proxy ou antivirus ; ne désactivez pas la vérification TLS.';
    } else if (codes.some((value) => ['ENOTFOUND', 'EAI_AGAIN'].includes(value))) {
      code = 'NETWORK_DNS';
      message =
        'Node.js ne parvient pas à résoudre db.ygoprodeck.com. Vérifiez la connexion et le DNS.';
    } else if (
      (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) ||
      codes.some((value) =>
        [
          'ETIMEDOUT',
          'UND_ERR_CONNECT_TIMEOUT',
          'UND_ERR_HEADERS_TIMEOUT',
          'UND_ERR_BODY_TIMEOUT',
        ].includes(value),
      )
    ) {
      code = 'NETWORK_TIMEOUT';
      message =
        'Le téléchargement YGOPRODeck a dépassé le délai autorisé. Vérifiez la connexion ou réessayez plus tard.';
    } else if (
      codes.some((value) =>
        ['ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_SOCKET'].includes(
          value,
        ),
      ) ||
      (error instanceof TypeError && error.message === 'fetch failed')
    ) {
      code = 'NETWORK_CONNECTION';
      message =
        'Node.js ne peut pas joindre YGOPRODeck. Vérifiez l’accès à db.ygoprodeck.com et la configuration du proxy ou du pare-feu.';
    } else {
      code = 'CATALOG_IMPORT_FAILED';
      status = isImport ? 400 : 500;
      message =
        'Le catalogue n’a pas pu être importé. Vérifiez le fichier ou le stockage local ; la cause n’est pas identifiée comme une erreur réseau.';
    }
  }
  return { code, status, error: `${message} Le catalogue actuel est conservé.` };
}
