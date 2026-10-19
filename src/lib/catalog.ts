import { z } from 'zod';
import type { Card } from './types';
import { CatalogSyncError } from './catalog-errors';

// Optional provider metadata may be null. Numeric strings are accepted explicitly;
// do not use z.coerce.number(), which would turn null and empty strings into zero.
const optionalInteger = z
  .union([
    z.number().int(),
    z
      .string()
      .regex(/^-?\d+$/)
      .transform(Number)
      .pipe(z.number().int()),
  ])
  .nullish();

// Providers use both "Forbidden" and "Banned" for the same zero-copy rule.
// Canonicalize known spellings only; an unrecognized restriction must fail import.
const tcgRestriction = z
  .string()
  .transform((value) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-'),
  )
  .pipe(z.enum(['banned', 'forbidden', 'limited', 'semi-limited', 'unlimited']))
  .transform((value) =>
    value === 'banned' || value === 'forbidden'
      ? 0
      : value === 'limited'
        ? 1
        : value === 'semi-limited'
          ? 2
          : 3,
  );

const externalCard = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  type: z.string(),
  desc: z.string(),
  frameType: z.string().nullish(),
  race: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  attribute: z.string().nullish(),
  level: optionalInteger,
  linkval: optionalInteger,
  atk: optionalInteger,
  def: optionalInteger,
  archetype: z.string().nullish(),
  banlist_info: z.object({ ban_tcg: tcgRestriction.nullish() }).nullish(),
  card_images: z
    .array(
      z.object({ id: z.number(), image_url: z.string().url(), image_url_small: z.string().url() }),
    )
    .min(1),
});
export function normalizeCatalog(input: unknown): Card[] {
  const payload = z.object({ data: z.array(externalCard).min(1) }).parse(input);
  const ids = new Set<number>();
  return payload.data
    .filter((card) => card.type !== 'Token' && !card.type.includes('Skill'))
    .map((card) => {
      if (ids.has(card.id))
        throw new CatalogSyncError('CATALOG_DUPLICATE', `Identifiant dupliqué : ${card.id}.`, 400);
      ids.add(card.id);
      const artwork = card.card_images.find((image) => image.id === card.id) || card.card_images[0];
      for (const url of [artwork.image_url, artwork.image_url_small]) {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'images.ygoprodeck.com')
          throw new CatalogSyncError(
            'CATALOG_IMAGE_SOURCE',
            'Source d’image non autorisée dans le catalogue.',
            400,
          );
      }
      return {
        id: card.id,
        name: card.name,
        type: card.type,
        category:
          card.type === 'Spell Card' ? 'Spell' : card.type === 'Trap Card' ? 'Trap' : 'Monster',
        frame: card.frameType || 'effect',
        description: card.desc,
        attribute: card.attribute || null,
        race: card.race,
        level: card.linkval ?? card.level ?? null,
        atk: card.atk ?? null,
        def: card.def ?? null,
        archetype: card.archetype || null,
        image: artwork.image_url,
        imageSmall: artwork.image_url_small,
        limit: card.banlist_info?.ban_tcg ?? 3,
        extra: /Fusion|Synchro|XYZ|Link/i.test(card.type),
      };
    });
}
