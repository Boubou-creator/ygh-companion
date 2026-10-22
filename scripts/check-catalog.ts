import { ZodError } from 'zod';
import { normalizeCatalog } from '../src/lib/catalog';
import { describeCatalogFailure, providerHttpError } from '../src/lib/catalog-errors';

// Read-only validation against the same adapter as the application. No database writes.
async function main() {
  try {
    const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php', {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw providerHttpError(response.status);
    const input: unknown = await response.json();
    try {
      const cards = normalizeCatalog(input);
      console.log(
        `Catalogue compatible : ${cards.length} cartes jouables validées. Aucune modification de la base.`,
      );
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(
          `${error.issues.length} erreur(s) de format détectée(s) ; les 20 premières :`,
        );
        for (const issue of error.issues.slice(0, 20)) {
          const value = issue.path.reduce<unknown>(
            (current, key) =>
              current && typeof current === 'object'
                ? (current as Record<PropertyKey, unknown>)[key]
                : undefined,
            input,
          );
          const summary =
            value === null
              ? 'null'
              : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                ? JSON.stringify(value).slice(0, 80)
                : typeof value;
          console.error(`${issue.path.map(String).join('.')} : ${summary}`);
        }
      }
      throw error;
    }
  } catch (error) {
    const failure = describeCatalogFailure(error, false);
    console.error(`[${failure.code}] ${failure.error}`);
    process.exitCode = 1;
  }
}
void main();
