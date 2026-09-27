# AZM — landing de campagne

## Avant de toucher au style : lire `DESIGN.md`

`DESIGN.md` est le contrat visuel. Il n'est pas indicatif. Il contient la palette, la
typographie, le rôle de la photographie, et une liste noire de motifs interdits parce
qu'ils font qu'une page se lit comme générée plutôt que dessinée.

Le point le plus contre-intuitif, et celui qu'on ré-oublie à chaque fois : **le magasin
d'AZM est blanc avec une chrome noire et des photos sombres, pas un aplat noir.** Le
noir vient d'une image, jamais d'un `background`.

## Avant de toucher au code

`README.md` porte l'architecture, la garde `server-only` sur `catalog.json` et
`reviews.json`, le chemin du lead vers GoHighLevel, et la règle sur les bords.

Deux choses qui cassent le build si on les oublie, et c'est voulu :

- Un composant `'use client'` ne doit **jamais** importer `lib/catalog.ts` ni
  `lib/reviews.ts`. Les types et les fonctions pures vivent dans `catalogTypes.ts` et
  `reviewTypes.ts`, qui sont importables côté client.
- Toute qualité d'image passée à `next/image` doit être déclarée dans
  `next.config.ts` → `images.qualities`. Next 16 répond 400 pour les autres.

## Les deux sources d'avis ne se mélangent pas

Les avis Google portent sur le **commerce** (`CONFIG.GOOGLE`, écrit à la main). Les avis
de `reviews.json` portent sur une **pièce** et viennent de l'app du magasin. Les
présenter comme des avis Google serait une fausse indication d'origine. Les libellés à
l'écran doivent rester distincts.

## Vérifier avant de dire que c'est fait

Capturer l'écran et regarder la capture. `npm run build && npm start`, puis
`node tools/shot.mjs`. Pour les largeurs téléphone, passer par
`Emulation.setDeviceMetricsOverride` du protocole DevTools : Chrome headless sur cette
machine clampe la fenêtre autour de 500 px et fabrique des bogues qui n'existent pas.
