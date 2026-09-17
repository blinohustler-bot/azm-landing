# AZ Motorsport — landing de campagne (fitment)

Page d'atterrissage pour les pubs Meta d'AZ Motorsport. Le visiteur choisit son char en
trois clics, laisse ses coordonnées, et voit **les pièces réellement construites pour son
châssis** — prix, stock et compatibilité tirés en direct du catalogue Shopify.

Page statique : un fichier HTML, un catalogue JSON, aucun serveur, aucune dépendance npm.

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

Tout est en haut du bloc `<script>` de `index.html`, dans `CONFIG` :

| Réglage | À mettre | Sans ça |
|---|---|---|
| `LEAD_ENDPOINT` | URL qui reçoit le lead en POST JSON | **le lead n'est envoyé nulle part** |
| `PIXEL` | id du pixel Meta (`854592952776027`) | aucune mesure côté Meta |
| `TALK` | lien de conversation (m.me de la Page) | le bouton retombe sur le téléphone |
| `GATE_FIRST` | `false` par défaut | voir plus bas |

`LEAD_ENDPOINT` est le seul point bloquant : AZM n'a pas de CRM, ses leads Meta tombent
aujourd'hui dans la boîte de réception Meta Business.

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
node tools/shot.mjs                         # capture la page en 390 / 820 / 1440 px
node tools/shot.mjs "?make=BMW&model=m3"    # capture un état précis du parcours
node tools/audit.mjs                        # liste les éléments qui débordent, par largeur
node tools/normalize-logos.mjs              # recadre les viewBox des logos sur leur dessin
node tools/clean-logos.mjs                  # retire les fonds blancs des logos téléchargés
```

Les deux premiers passent par le Chrome déjà installé sur la machine — aucune dépendance.
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

Page statique : n'importe quel hébergement de fichiers fait l'affaire (Vercel, Netlify,
Pages). Le paiement, lui, reste **entièrement chez Shopify** — « Buy now » ouvre
`azmotorsport.ca/cart/<variante>:1`, qui redirige vers le checkout. Aucune donnée de
paiement ne transite par cette page.
