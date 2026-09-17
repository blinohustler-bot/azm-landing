# AZ Motorsport — landing de campagne (fitment)

Page d'atterrissage pour les pubs Meta d'AZ Motorsport. Le visiteur choisit son char en
trois clics, laisse ses coordonnées, et voit **les pièces réellement construites pour son
châssis** — prix, stock et compatibilité tirés en direct du catalogue Shopify.

Page statique — un fichier HTML, un catalogue JSON, aucune dépendance npm — plus une
seule fonction serveur, `/api/lead`, qui écrit le lead dans GoHighLevel. Elle existe
uniquement parce que le jeton GHL ne peut pas vivre dans une page publique.

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

**Dans `CONFIG`, en haut du bloc `<script>` de `index.html` :**

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

## Le lead → GoHighLevel

```
formulaire  →  POST /api/lead  →  contacts/upsert      →  contactId
                (fonction Vercel)  opportunities/       →  l'opportunité
                                   contacts/{id}/notes  →  le détail du fitment
```

**Le jeton ne descend jamais dans le navigateur.** L'API GHL s'ouvre avec un Private
Integration token qui donne accès à tout le sous-compte : posé dans `index.html`, il
serait public au premier « afficher la source ». Il vit dans `process.env` de la
fonction, et la page ne connaît que l'URL `/api/lead`.

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

## Mettre à jour le catalogue

```bash
node build-index.mjs
```

Tire `azmotorsport.ca/products.json` et les photos de collection, et régénère
`catalog.json` + `catalog.js` : 9 marques, 99 modèles, 121 pièces, avec variantes, prix,
stock, lignes de compatibilité et générations. À relancer quand le catalogue Shopify bouge.

Aucun jeton requis : `products.json` et `collections.json` sont publics.

---

## Outils (`tools/`)

```bash
node tools/ghl-check.mjs                    # vérifie le jeton GHL, liste pipelines et ids
node tools/lead.test.mjs                    # exerce /api/lead contre un faux GHL
node tools/shot.mjs                         # capture la page en 390 / 820 / 1440 px
node tools/shot.mjs "?make=BMW&model=m3"    # capture un état précis du parcours
node tools/audit.mjs                        # liste les éléments qui débordent, par largeur
node tools/normalize-logos.mjs              # recadre les viewBox des logos sur leur dessin
node tools/clean-logos.mjs                  # retire les fonds blancs des logos téléchargés
```

`ghl-check` lit `.env` à la racine (copié de `.env.example`, ignoré par git) et n'écrit
rien dans GHL. `lead.test` ne sort pas de la machine.

`shot` et `audit` passent par le Chrome déjà installé sur la machine — aucune dépendance.
`--force-device-scale-factor=1` y est obligatoire : sans lui, l'échelle Windows à 125 %
fait rendre une fenêtre de 390 px à 485 px CSS et fabrique des bugs qui n'existent pas.

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

Vercel, parce que `/api/lead` a besoin d'un serveur. Le reste (`index.html`, le catalogue,
les logos) est servi tel quel depuis la racine ; `vercel.json` pose les en-têtes de
sécurité, la CSP et le cache.

1. **Importer le dépôt** sur [vercel.com/new](https://vercel.com/new). Aucun framework,
   aucune commande de build, racine `/` — la détection automatique tombe juste.
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
