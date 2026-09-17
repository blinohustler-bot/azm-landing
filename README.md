# AZ Motorsport — landing de campagne (fitment)

Page d'atterrissage pour les pubs Meta d'AZ Motorsport. Le visiteur choisit son char en
trois clics, laisse ses coordonnées, et voit **les pièces réellement construites pour son
châssis** — prix, stock et compatibilité tirés en direct du catalogue Shopify.

Application Next.js (App Router, TypeScript) déployée sur Vercel. Le catalogue est lu
côté serveur, le lead part dans GoHighLevel par `/api/lead`, et le paiement reste
entièrement chez Shopify.

```bash
npm install
npm run dev          # http://localhost:3000
```

---

## Pourquoi cette page existe

| Fait | Chiffre |
|---|---|
| Retours de pièces auto en ligne causés par un mauvais fitment | **86 %** |
| Abandon de panier en e-commerce auto | **~70 %**, en grande partie par anxiété de fitment |
| Effet d'un sélecteur Année/Marque/Modèle | **+30 à 45 % de conversion**, **−50 à 60 % de retours** |
| Taux de retour constaté chez AZM | 18 % en juin, 27 % en juillet, 19 % sur trois mois |

Détail des sources et des choix de conception : `docs/clients/azm-lp-psychologie-recherche.md`
dans le dépôt `tps-agent-os`.

---

## À remplir avant la mise en ligne

Deux endroits, et un seul est bloquant.

**Dans `lib/config.ts`** — ce qui part dans le navigateur, et rien de secret :

| Réglage | État | Sans ça |
|---|---|---|
| `LEAD_ENDPOINT` | `/api/lead` — la fonction de ce dépôt | le lead n'est envoyé nulle part |
| `PIXEL` | `854592952776027` | aucune mesure côté Meta |
| `TALK` | **vide** — lien m.me de la Page | le bouton « parler à un builder » retombe sur le téléphone |
| `GATE_FIRST` | `false` | voir plus bas |

**Dans Vercel > Settings > Environment Variables** — les noms et le détail sont dans
`.env.example` :

| Variable | Requis | Rôle |
|---|---|---|
| `GHL_API_KEY` | oui | le Private Integration token du sous-compte AZM |
| `GHL_LOCATION_ID` | oui | le sous-compte visé |
| `GHL_PIPELINE_ID` + `GHL_STAGE_ID` | fortement conseillé | où atterrit l'opportunité |
| `ALLOWED_ORIGINS` | conseillé | qui a le droit de poster sur `/api/lead` |

Sans les deux premières, `/api/lead` répond 502 et le lead n'atteint rien. Sans les
suivantes, il part dans le **premier pipeline du sous-compte, première étape** — ce qui
suffit pour un test et bouge dès que quelqu'un réordonne un pipeline dans GHL.

```bash
node tools/ghl-check.mjs     # imprime les pipelines, leurs étapes et les ids à coller
```

---

## L'architecture

```
app/
  page.tsx              décide l'écran à partir de l'URL, côté serveur
  layout.tsx            coquille, police Archivo auto-hébergée, pixel Meta
  globals.css           tout le style : tokens, écrans, cartes
  api/lead/route.ts     le lead → GHL
components/             un fichier par écran ; 'use client' seulement où il le faut
lib/
  catalog.ts            le catalogue, SERVEUR UNIQUEMENT (import 'server-only')
  catalogTypes.ts       types + fonctions pures, importables côté client
  config.ts             réglages publics de campagne
  ghl.ts / leadPayload.ts   client GHL et normalisation du lead
catalog.json            360 ko, généré ; ne descend jamais dans le navigateur
```

**Une étape = une URL.** `/?make=BMW&model=m3&year=2021`. Les sept écrans étaient
empilés dans un seul document, masqués en `display:none`, avec un tableau `trail`
maison qui doublait l'historique du navigateur et s'en désynchronisait dès qu'on
touchait au bouton « précédent » du téléphone. Le serveur n'envoie plus que l'écran
demandé, le bouton du navigateur marche, et une pub peut viser un modèle précis.

**`lib/catalog.ts` porte `import 'server-only'`, et ce n'est pas décoratif.** Un
composant `'use client'` qui l'importe embarque les 360 ko du catalogue dans le bundle.
C'est arrivé pendant ce refactor — `ProductCard` importait `fitmentLines` de là, et le
catalogue se retrouvait dans un chunk client de 42 ko gzip. D'où `lib/catalogTypes.ts`,
qui ne touche à aucune donnée et que le client peut importer sans risque. La garde fait
maintenant échouer le build au lieu de laisser passer.

### Ce que le passage à Next a coûté et rapporté

Mesuré sur le build de production, pas estimé :

| | Ancienne page statique | Next |
|---|---|---|
| HTML (gzip) | 15 ko | 5 ko |
| JS (gzip) | 28 ko (`catalog.js`) | **174 ko** |
| CSS (gzip) | inline | 4 ko |
| Une photo produit | 166 ko (Shopify `?width=900`) | **32 ko** (AVIF, `next/image`) |

**Le JS a grossi, et c'est le prix réel du framework** : React et le runtime de l'App
Router coûtent plus cher que ne coûtait le catalogue, qui se compressait très bien.
Personne ne devrait lire « on a retiré 280 ko de JS » : c'est faux.

Ce qui est gagné, en revanche :

- **Le premier écran arrive en HTML.** L'ancienne page n'affichait *rien* tant que
  `catalog.js` n'était pas téléchargé, analysé et exécuté. C'est ce que la pub paie.
- **Les images.** 134 ko économisés par photo produit, et il y en a jusqu'à quatre sur
  un écran de résultats. Sur ces écrans-là, l'image rembourse le JS à elle seule.
- **La police est auto-hébergée.** Deux préconnexions et une feuille de style bloquante
  vers Google Fonts en moins — et la CSP peut désormais interdire `fonts.gstatic.com`.
- Le bouton « précédent », les liens profonds, l'accessibilité et le typage.

---

## Le lead → GoHighLevel

```
formulaire  →  POST /api/lead  →  contacts/upsert      →  contactId
                (fonction Vercel)  opportunities/       →  l'opportunité
                                   contacts/{id}/notes  →  le détail du fitment
```

**Le jeton ne descend jamais dans le navigateur.** L'API GHL s'ouvre avec un Private
Integration token qui donne accès à tout le sous-compte : posé dans `lib/config.ts`, il
partirait dans le bundle du navigateur et serait public au premier « afficher la
source ». Il vit dans `process.env`, côté serveur, et la page ne connaît que l'URL
`/api/lead`.

**L'opportunité naît à l'étape 04, pas aux résultats.** La personne a donné ses
coordonnées : elle peut regarder les pièces et refermer l'onglet dans la minute. Le
formulaire attend donc la confirmation d'écriture — au plus cinq secondes — avant
d'afficher les pièces. Si elle ne vient pas, la personne passe quand même aux pièces,
le lead est conservé dans le navigateur, et `LeadRetry` le rejoue au chargement
suivant puis à chaque visite. Rejouer est sans danger : voir le paragraphe suivant.

Le cookie « ce visiteur est dans GHL » n'est posé **qu'après** une écriture confirmée.
Il l'était auparavant avant même la requête : un premier envoi raté marquait la
personne comme connue à vie, elle ne revoyait jamais le formulaire, et elle n'entrait
donc jamais dans GHL.

**Upsert, jamais create.** La page est publique et le même client revient — souvent pour
essayer un deuxième char. GHL déduplique le contact sur le courriel et le téléphone ;
côté opportunité, la fonction cherche d'abord un deal **ouvert** du même contact dans le
même pipeline et le met à jour au lieu d'en ouvrir un second. Un doublon dans une colonne
fausse le pipeline et son reporting.

**Ce que le builder lit.** Le nom de l'opportunité est
`BMW M3 (2015–2020 · F80) — Alex Tremblay` : le char d'abord, la personne ensuite, parce
que c'est ce qui est visible sans ouvrir la fiche. La valeur monétaire est la **somme des
prix plancher** des pièces compatibles — le sol du deal, jamais son plafond. Le détail
(pièces, prix, provenance UTM, page) part en note sur le contact, à chaque passage : c'est
l'historique.

**Ce qui est refusé.** Un champ piège invisible et un chronomètre minimal de 2,5 s
écartent les robots — réponse 200 muette, rien n'est écrit, parce qu'un 403 apprendrait au
script quoi contourner. `ALLOWED_ORIGINS` refuse les pages tierces qui postent chez nous.
Deux compteurs par IP bornent le trafic (40 / 10 min) et les écritures dans GHL
(6 / 10 min) séparément : une personne qui rate cinq fois son numéro de téléphone ne doit
pas se faire fermer la porte. Aucun champ inconnu n'est recopié vers GHL, et aucune erreur
d'upstream n'est renvoyée au navigateur — le détail reste dans les logs Vercel.

```bash
node tools/lead.test.mjs     # 37 vérifications, faux GHL, aucune requête ne sort
```

---

## Le parcours

```
01 marque  →  02 modèle  →  03 génération*  →  04 coordonnées  →  les pièces
                                                                   ↘ achat direct (checkout Shopify)
                                                                   ↘ appel d'un builder
```

**\* l'étape 3 ne s'affiche que quand elle sert.** 81 modèles sur 99 n'ont qu'une seule
génération : la demander serait un clic pour rien. Les 18 autres sont les gros vendeurs
(M3, M5, 911 Turbo, GT3), où deux générations **ne partagent aucune pièce** — là, la
question est ce qui évite la mauvaise vente.

**Les coordonnées viennent après le choix du char, pas avant.** Un formulaire placé avant
la première question a le plus haut taux d'abandon ; après trois clics, la réciprocité
joue. `GATE_FIRST: true` inverse l'ordre si on veut tester l'autre sens — le juge est le
coût par lead *servable*, pas le nombre de leads.

**Pas de checkout automatique, même quand une seule pièce est compatible.** 42 % des
combinaisons de char ne donnent qu'une pièce, mais aucune n'a une seule variante : il
reste toujours le choix Race (catless) / High Flow (catted), c'est-à-dire *légal sur route
ou non*, et jusqu'à 1 600 $ d'écart. Choisir à la place du client serait une faute.

---

## Une dette connue : les lignes de fitment

`build-index.mjs` tire les lignes de compatibilité de la description Shopify, et sur
**58 fiches sur 120** il ramasse aussi le corps du texte marketing. L'encadré « Built
for these exact cars » affichait donc « Key Features », « Two Material Choices: Go T304
stainless steel… » — au milieu de l'élément sur lequel repose tout l'argument de la
page. Un bloc de fitment qui contient de la publicité ne prouve plus rien.

`lib/catalogTypes.ts` filtre à l'affichage : une ligne de fitment commence par une
année ou une plage d'années. Le filtre s'efface s'il ne laisse rien — la McLaren P1
décrit sa compatibilité sans millésime, et une liste vide serait pire que le bruit.

**Le vrai correctif est dans l'extraction**, côté `build-index.mjs`. Il demande de
régénérer le catalogue depuis Shopify et de vérifier les 120 fiches ; le filtre tient
en attendant.

---

## Mettre à jour le catalogue

```bash
node build-index.mjs
```

Tire `azmotorsport.ca/products.json` et les photos de collection, et régénère
`catalog.json` : 9 marques, 99 modèles, 121 pièces, avec variantes, prix,
stock, lignes de compatibilité et générations. À relancer quand le catalogue Shopify bouge.

Aucun jeton requis : `products.json` et `collections.json` sont publics.

---

## Outils (`tools/`)

```bash
npm run dev            # le serveur ; les outils de capture en ont besoin
npm run build          # build de production
npm run lint           # tsc --noEmit
npm test               # exerce /api/lead contre un faux GHL, hors ligne
npm run ghl:check      # vérifie le jeton GHL, liste pipelines et ids
npm run catalog        # régénère catalog.json depuis Shopify

node tools/shot.mjs                         # capture en 390 / 820 / 1440 px
node tools/shot.mjs "?make=BMW&model=m3"    # capture un état précis du parcours
node tools/audit.mjs                        # liste les éléments qui débordent, par largeur
node tools/normalize-logos.mjs              # recadre les viewBox des logos sur leur dessin
node tools/clean-logos.mjs                  # retire les fonds blancs des logos téléchargés
```

`npm test` importe la vraie route : Node exécute le TypeScript nativement, et
`tools/alias-hook.mjs` lui apprend l'alias `@/` de tsconfig. 41 vérifications, aucune
requête ne sort de la machine.

`AZM_URL` vise un autre serveur que `localhost:3000` — une préproduction Vercel, par
exemple. `AZM_PATH` audite une autre étape du parcours.

`ghl-check` lit `.env` à la racine (copié de `.env.example`, ignoré par git) et n'écrit
rien dans GHL.

`shot` et `audit` passent par le Chrome déjà installé sur la machine — aucune dépendance.
`--force-device-scale-factor=1` y est obligatoire : sans lui, l'échelle Windows à 125 %
fait rendre une fenêtre de 390 px à 485 px CSS et fabrique des bugs qui n'existent pas.

**Limite connue de `audit`** : Chrome sous Windows impose une largeur de fenêtre
minimale d'environ 500 px, donc l'audit à « 390 px » mesure en réalité 500 px. Il attrape
encore les débordements francs, mais il ne prouve pas que la page tient sur un iPhone.
Pour ça, le mode appareil des outils de développement, ou un vrai téléphone.

Deux pages de contrôle s'ouvrent directement dans un navigateur :
`responsive-check.html` (téléphone / tablette / ordinateur côte à côte) et
`logos-check.html` (les neuf logos dans le pire cas de contraste).

---

## Logos des constructeurs

`assets/brands/<marque>.svg`, affichés dans leurs vraies couleurs. Fonds retirés et
viewBox recadrés, sinon un logo se rend quatre fois plus petit que son voisin (le McLaren
n'occupait que 13 % de son cadre d'origine).

Ce sont des **marques déposées**. Un revendeur a le droit de les afficher pour indiquer la
compatibilité — c'est l'usage de tout le créneau — et la page porte la mention requise en
pied. Idéalement, AZM fournit ses propres fichiers : déposer le SVG au bon nom suffit,
rien d'autre à changer.

---

## Mise en ligne

Vercel, parce que le rendu et `/api/lead` ont besoin d'un serveur. Les en-têtes de
sécurité, la CSP et le cache sont dans `next.config.ts` — une seule source, appliquée
aussi en `npm run dev`, là où une CSP cassée se voit tout de suite.

1. **Importer le dépôt** sur [vercel.com/new](https://vercel.com/new). Vercel détecte
   Next.js et configure le build tout seul — rien à régler.
2. **Poser les variables** (Settings > Environment Variables), pour les trois
   environnements. Voir `.env.example` ; `node tools/ghl-check.mjs` donne les ids.
3. **Déployer**, puis remplir `ALLOWED_ORIGINS` avec l'URL obtenue et redéployer.
4. **Vérifier avec un vrai lead** : remplir le formulaire, puis regarder la colonne du
   pipeline dans GHL. Les logs de la fonction sont dans Vercel > Deployments > Functions ;
   `LEAD_DEBUG=1` y ajoute le détail de l'erreur upstream dans la réponse HTTP — à
   retirer avant d'ouvrir la campagne.

Un déploiement en préproduction (`vercel --prod=false`) porte ses propres variables :
pointer un jeton GHL de test dessus évite de salir le pipeline pendant les essais.

Le paiement, lui, reste **entièrement chez Shopify** — « Buy now » ouvre
`azmotorsport.ca/cart/<variante>:1`, qui redirige vers le checkout. Aucune donnée de
paiement ne transite ni par cette page ni par la fonction.

### Ce qui reste à faire une fois en ligne

- `CONFIG.TALK` est vide : le bouton « parler à un builder » compose le téléphone. Le
  lien m.me de la Page AZM y va dès qu'il est connu.
- `ALLOWED_ORIGINS` reste vide tant que le domaine final n'est pas fixé ; d'ici là,
  n'importe quelle origine peut poster sur `/api/lead`.
- La limite de débit vit dans la mémoire d'un lambda : elle tient contre un script isolé,
  pas contre une attaque distribuée. Si ça devient un problème, c'est Vercel Firewall ou
  un KV partagé, pas un compteur plus gros.
