# YGH Companion — Deck Studio

MVP d’un deck builder Yu-Gi-Oh! en français, construit avec Next.js 16, React 19, TypeScript et SQLite. Cartes en anglais. Utilisation locale, mono-espace, sans compte ni authentification.

## Démarrer

Prérequis : **Node.js 24.5 ou supérieur**, npm. SQLite est inclus dans Node, aucun service de base de données à installer.

```bash
npm ci
npm run dev
```

Le serveur utilise le port 3000. Pour un build de production :

```bash
npm run build
npm start
```

Les scripts Node activent la prise en charge des proxys d’environnement. Le dépôt courant suffit : chaque tâche cloud est isolée, aucun worktree supplémentaire n’est nécessaire.

## Ce qui fonctionne

- Catalogue local avec recherche par nom ou effet, filtres catégorie, attribut, niveau/rang/Link et archétype, pagination serveur.
- Fiche avec illustration distante, effet, caractéristiques et restriction TCG du fournisseur.
- Éditeur Main / Extra / Side : ajout rapide, retrait, déplacement par glisser-déposer. Pour une utilisation tactile ou au clavier, sélectionner une zone puis ajouter la carte avec son bouton.
- Contrôle des tailles, du placement et des restrictions cumulées dans les trois zones. Trois exemplaires maximum à l’ajout ; les restrictions plus fortes restent visibles dans les erreurs pour autoriser les brouillons.
- Brouillon conservé dans le navigateur ; sauvegarde explicite, duplication, réouverture et suppression des decks dans SQLite. Verrouillage optimiste pour refuser une sauvegarde obsolète.
- Import/export `.ydk`. Un import contenant des passcodes inconnus est refusé sans remplacer le brouillon.
- Analyse exacte de la probabilité d’ouvrir au moins une carte d’un ensemble choisi dans une main de cinq cartes, par distribution hypergéométrique.
- Interface responsive et navigation au clavier, fenêtres avec gestion du focus et fermeture par Échap.

## Catalogue et restrictions : provenance explicite

Au premier accès, une sélection de **33 cartes de démonstration** est insérée. Les descriptions sont des résumés éditoriaux et les restrictions sont **illustratives**, sans date officielle. Un prototype Dark Magician incomplet sert de point de départ dans l’éditeur ; le bouton « Nouveau deck » ouvre un brouillon vide.

Dans « État des données » :

1. **Synchroniser avec YGOPRODeck** charge `https://db.ygoprodeck.com/api/v7/cardinfo.php` côté serveur.
2. **Importer une réponse JSON** accepte le fichier complet de ce même endpoint, avec son objet `{ "data": [...] }`, jusqu’à 30 Mo. Ce chemin fonctionne si le serveur n’a pas d’accès réseau au fournisseur.

La synchronisation n’est pas automatique. Elle valide les données, exclut les Tokens et Skill Cards, effectue des upserts en transaction puis active le nouveau catalogue. Une réponse distante de moins de 1 000 cartes, un doublon, une source d’image inattendue ou une baisse de plus de 10 % d’un catalogue déjà importé est refusée. Les anciennes cartes restent conservées pour ne pas casser les decks existants. Les imports réussis et les versions des restrictions sont historisés dans la base.

Les restrictions sont extraites du champ `banlist_info.ban_tcg`, avec un maximum par défaut de trois exemplaires lorsque ce champ est absent. **Ce n’est pas une certification de légalité officielle.** La date d’effet reste inconnue ; les équivalences particulières de noms, dates de sortie, cartes non disponibles en TCG et règles de tournoi ne sont pas encore couvertes. Consulter les sources officielles avant un tournoi. Le moteur valide également côté serveur à l’enregistrement et retourne son résultat, tout en permettant les brouillons incomplets.

Les images sont chargées directement depuis `images.ygoprodeck.com`, avec miniatures, chargement différé et carte de remplacement en cas d’échec. Elles ne sont pas recopiées dans le dépôt ou redistribuées. Les droits et conditions du fournisseur devront être examinés avant un déploiement public ou l’ajout d’un cache d’images.

### Réseau cloud

Domaines requis : `db.ygoprodeck.com`, `images.ygoprodeck.com`. Sans leur autorisation dans les paramètres réseau, le catalogue de démo et les visuels de remplacement restent utilisables. Dans l’environnement de création, l’accès à ces deux domaines était bloqué ; le téléchargement du catalogue complet et des illustrations n’a donc pas été validé en direct. Après application des autorisations, utiliser « Synchroniser » et vérifier la source et le nombre de cartes.

## Dépanner une synchronisation

Une erreur de synchronisation reste affichée dans « État des données », avec un code de diagnostic. Le catalogue actif est conservé en cas d’échec.

| Code                                        | Signification                                     | Vérification                                                         |
| ------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `NETWORK_DNS`                               | Node ne résout pas le domaine                     | Connexion et DNS                                                     |
| `NETWORK_TLS`                               | Certificat HTTPS non vérifiable                   | Certificats système, proxy ou antivirus ; ne pas désactiver TLS      |
| `NETWORK_TIMEOUT`                           | Téléchargement trop lent ou connexion interrompue | Connexion, puis nouvelle tentative                                   |
| `NETWORK_CONNECTION`                        | Connexion refusée ou interrompue                  | Pare-feu et configuration du proxy                                   |
| `PROVIDER_HTTP_403` / `PROVIDER_HTTP_429`   | Accès refusé / limite de requêtes                 | Autorisations réseau / attendre avant de réessayer                   |
| `CATALOG_SCHEMA` / `CATALOG_JSON`           | Données incompatibles ou JSON invalide            | Copier le message et le champ indiqué ; un accès réseau a pu réussir |
| `CATALOG_INCOMPLETE` / `CATALOG_COUNT_DROP` | Réponse incomplète                                | Import refusé par sécurité                                           |

Sur la machine qui exécute l’application, cette commande PowerShell teste l’accès de Node au fournisseur sans afficher de configuration privée :

```powershell
node --use-env-proxy -e "fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php').then(r=>console.log('HTTP',r.status)).catch(e=>console.log(e.message,e.cause?.code,e.cause?.errors?.map(x=>x.code)))"
```

Un navigateur et Node peuvent utiliser des proxys ou magasins de certificats différents. Si l’URL s’ouvre dans le navigateur, enregistrer sa réponse JSON permet de tester le chemin d’import local pendant le diagnostic de la connexion Node.

## Stockage et architecture

```text
src/app/                  Pages et API HTTP Next.js
src/components/           Interface du studio et cartes
src/lib/catalog.ts        Adaptateur validé de YGOPRODeck (Zod)
src/lib/db.ts             Schéma relationnel, transactions, dépôt de decks
src/lib/rules.ts          Règles pures, import/export YDK, probabilités
src/lib/http.ts           Contrôle d’origine et limite des corps JSON
src/lib/types.ts          Contrats partagés
src/lib/seed.ts           Sélection hors ligne explicitement illustrative
tests/                    Tests unitaires et intégration SQLite temporaire
e2e/                      Parcours réels dans Chromium avec Playwright
```

Tables : `cards`, `decks`, `deck_entries`, `metadata`, `import_runs`, `banlist_versions`, `banlist_entries`. Les clés étrangères protègent les références et les écritures sont atomiques. Les principales propriétés de recherche sont indexées ; la recherche textuelle `LIKE` reste volontairement simple pour le MVP. Pour une recherche tolérante aux fautes à plus grande échelle, migrer vers PostgreSQL avec `pg_trgm` ou une recherche plein texte.

La base est créée dans `.data/companion.sqlite`, ignorée par Git. `DATABASE_PATH` permet de choisir un autre emplacement inscriptible. Next charge les variables de `.env.local` si nécessaire ; `.env.example` documente l’option. Le fichier de base et les fichiers WAL associés doivent résider sur un stockage persistant. Pour sauvegarder une base en cours d’utilisation, employer l’API SQLite de sauvegarde plutôt qu’une simple copie du fichier actif.

L’API n’a pas besoin de clé secrète YGOPRODeck :

| Endpoint                          | Usage                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/cards`                  | Filtres `q`, `category`, `attribute`, `level`, `archetype`, `page` ; pages de 30 |
| `GET /api/cards?ids=…`            | Charger les cartes d’un deck, jusqu’à 120 identifiants                           |
| `GET /api/catalog`                | Source, date d’import, nombre de cartes, version des restrictions                |
| `POST /api/catalog`               | Synchronisation distante                                                         |
| `POST /api/catalog?action=import` | Import du JSON fournisseur                                                       |
| `GET /api/decks`                  | Decks sauvegardés                                                                |
| `POST /api/decks`                 | Création ou mise à jour avec `id` et `version`                                   |
| `DELETE /api/decks/:id`           | Suppression                                                                      |

## Vérifier

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright utilise Chromium système à `/usr/bin/chromium`. Renseigner `CHROMIUM_PATH` pour un autre emplacement. Les tests lancent leur propre serveur sur le port **3100**, avec une base unique dans `.data/e2e/`, et ne réutilisent pas le serveur ni la base de travail. Arrêter ce serveur de test si le port est déjà occupé ; ne pas supprimer la base de travail pour lancer les tests.

Le contrôle d’origine protège les mutations contre les requêtes intersites, mais **ne remplace pas une authentification**. Tous les decks de cette instance appartiennent au même espace. Ne pas exposer ce MVP à des utilisateurs non fiables.

## Prochaines étapes

1. Authentification, propriétaires des decks et autorisation sur chaque opération ; protection de la synchronisation, quotas et limitation de débit.
2. PostgreSQL, migrations versionnées et recherche plein texte ; pagination des decks si nécessaire.
3. Source officielle de banlists datées par format, disponibilité des cartes et équivalences de noms.
4. Worker planifié avec verrou distribué et contrôle de la version du catalogue fournisseur, selon ses conditions d’utilisation.
5. Modèle complet des illustrations alternatives, échelles Pendulum et marqueurs Link ; OCG / Master Duel et autres langues.
6. Assistant : classification des starters/handtraps, moteur de recommandations explicables, puis modèle conversationnel utilisant des outils de catalogue et de validation. Les probabilités restent calculées par du code déterministe.

Yu-Gi-Oh! et les illustrations appartiennent à leurs ayants droit. Projet indépendant non affilié à Konami.
