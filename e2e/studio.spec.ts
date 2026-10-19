import { test, expect } from '@playwright/test';
test('search, filters, deck mutation, persistence, export and analysis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'De bonnes cartes.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voir Dark Magician', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Rechercher une carte' }).fill('Blue-Eyes');
  await expect(page.getByRole('button', { name: 'Voir Blue-Eyes White Dragon' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voir Dark Magician', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Ajouter Blue-Eyes White Dragon', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Détails de Blue-Eyes White Dragon' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retirer Blue-Eyes White Dragon du Main Deck' }).click();
  await expect(page.getByRole('button', { name: 'Détails de Blue-Eyes White Dragon' })).toHaveCount(
    0,
  );
  const name = `Test deck ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Nom du deck' }).fill(name);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Deck enregistré');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Nom du deck' })).toHaveValue(name);
  await expect(page.getByText('Enregistré', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Mes decks', exact: true })
    .click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .getByRole('button', { name: 'Ouvrir', exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le deck en YDK' }).click();
  expect((await download).suggestedFilename()).toContain('.ydk');
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Analyse', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Les chiffres, avant le duel.' })).toBeVisible();
  await expect(page.locator('.probability-number')).not.toHaveText('0.0%');
});
test('advanced filters, empty state, validation and accessible modal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Filtres avancés' }).click();
  await page.getByRole('combobox', { name: 'Attribut', exact: true }).selectOption('LIGHT');
  await expect(page.getByRole('button', { name: 'Voir Blue-Eyes White Dragon' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voir Dark Magician', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('textbox', { name: 'Rechercher une carte' }).fill('does-not-exist-123');
  await expect(page.getByRole('heading', { name: 'Aucune carte trouvée' })).toBeVisible();
  await page.getByRole('button', { name: 'Effacer les filtres' }).click();
  await expect(page.getByRole('button', { name: 'Voir Dark Magician', exact: true })).toBeVisible();
  await page.locator('.validation-status').click();
  await expect(page.getByRole('dialog')).toContainText('Main Deck : 29 cartes');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Catalogue démo' }).click();
  await expect(page.getByRole('dialog')).toContainText('Démonstration hors ligne');
  await page.getByRole('button', { name: 'Fermer la fenêtre' }).click();
});
test('mobile layout has no horizontal overflow and exposes card details', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Nom du deck' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Catalogue', exact: true })
    .click();
  await page.getByRole('button', { name: 'Voir Dark Magician', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fermer la fiche' })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('API rejects cross-origin mutations, unknown cards and stale writes', async ({ request }) => {
  const cross = await request.post('/api/decks', {
    headers: { origin: 'https://untrusted.test' },
    data: { name: 'Cross', entries: [] },
  });
  expect(cross.status()).toBe(403);
  const invalid = await request.post('/api/decks', {
    data: { name: 'Invalid', entries: [{ cardId: 999999999, zone: 'main', quantity: 1 }] },
  });
  expect(invalid.status()).toBe(400);
  const created = await request.post('/api/decks', {
    data: { name: 'Concurrency test', entries: [] },
  });
  expect(created.ok()).toBe(true);
  const { deck } = await created.json();
  const update = await request.post('/api/decks', { data: { ...deck, name: 'Updated' } });
  expect(update.ok()).toBe(true);
  const stale = await request.post('/api/decks', { data: deck });
  expect(stale.status()).toBe(409);
  await request.delete(`/api/decks/${deck.id}`);
  const before = await (await request.get('/api/catalog')).json();
  const badImport = await request.post('/api/catalog?action=import', {
    data: { data: [{ id: 1 }] },
  });
  expect(badImport.status()).toBe(400);
  expect(await (await request.get('/api/catalog')).json()).toEqual(before);
});

test('moves cards between zones and imports a YDK without losing quantities', async ({ page }) => {
  // Keep the source and destination visible for a native mouse drag.
  await page.setViewportSize({ width: 1440, height: 1300 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Voir Dark Magician', exact: true })).toBeVisible();
  const source = page
    .locator('.deck-card')
    .filter({ has: page.getByRole('button', { name: 'Détails de Dark Magician', exact: true }) });
  await source.dragTo(page.getByRole('region', { name: 'Side Deck', exact: true }));
  await expect(
    page
      .getByRole('region', { name: 'Side Deck', exact: true })
      .getByRole('button', { name: 'Détails de Dark Magician', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Main Deck', exact: true }).locator('.quantity-badge').first(),
  ).toHaveText('2×');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Fichier deck YDK').setInputFiles({
    name: 'Imported strategy.ydk',
    mimeType: 'text/plain',
    buffer: Buffer.from('#main\n46986414\n46986414\n#extra\n50237654\n!side\n14558127\n'),
  });
  await expect(page.getByRole('textbox', { name: 'Nom du deck' })).toHaveValue('Imported strategy');
  await expect(
    page.getByRole('region', { name: 'Main Deck', exact: true }).locator('.quantity-badge'),
  ).toHaveText('2×');
  await expect(
    page
      .getByRole('region', { name: 'Extra Deck', exact: true })
      .getByRole('button', { name: 'Détails de The Dark Magicians' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Side Deck', exact: true })
      .getByRole('button', { name: 'Détails de Ash Blossom & Joyous Spring' }),
  ).toBeVisible();
});

test('catalog file import publishes valid data and the imported restriction snapshot', async ({
  request,
}) => {
  const { demoCards } = await import('../src/lib/seed');
  const data = demoCards.map((card) => ({
    id: card.id,
    name: card.name,
    type: card.type,
    desc: card.description,
    frameType: card.frame,
    race: card.race,
    attribute: card.attribute ?? undefined,
    level: card.level ?? undefined,
    atk: card.atk ?? undefined,
    def: card.def ?? undefined,
    archetype: card.archetype ?? undefined,
    banlist_info:
      card.limit === 0
        ? { ban_tcg: 'Banned' }
        : card.limit === 1
          ? { ban_tcg: 'Limited' }
          : undefined,
    card_images: [{ id: card.id, image_url: card.image, image_url_small: card.imageSmall }],
  }));
  const response = await request.post('/api/catalog?action=import', { data: { data } });
  expect(response.ok()).toBe(true);
  const status = await response.json();
  expect(status.source).toBe('file');
  expect(status.count).toBe(33);
  expect(status.banlistVersion).toBeTruthy();
  const cards = await (await request.get('/api/cards?q=Pot%20of%20Greed')).json();
  expect(cards.cards[0].limit).toBe(0);
  const pagination = await (await request.get('/api/cards?page=2')).json();
  expect(pagination.cards.length).toBe(3);
  expect(pagination.page).toBe(2);
});

test('sync errors remain visible with an actionable diagnostic code', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'État des données', exact: true }).click();
  await page.route('**/api/catalog', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'NETWORK_TLS',
        error:
          'Node.js ne peut pas vérifier le certificat HTTPS. Le catalogue actuel est conservé.',
      }),
    });
  });
  await page.getByRole('button', { name: 'Synchroniser avec YGOPRODeck', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('NETWORK_TLS');
  await page.getByRole('button', { name: 'Fermer le message' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('certificat HTTPS');
});
