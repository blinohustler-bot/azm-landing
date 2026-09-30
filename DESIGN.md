# DESIGN.md — AZ Motorsport

Le contrat visuel de la landing de campagne. À lire **avant** de toucher au style, et à
respecter à la lettre : ce qui est écrit ici a été relevé sur les vrais actifs d'AZM, pas
choisi par goût. Quand un écran est régénéré sans ce fichier, le style dérive vers les
réglages par défaut du modèle, et ces réglages-là sont aujourd'hui reconnaissables.

> **Le test qui compte.** Un inconnu qui voit la page doit pouvoir dire de quel commerce
> il s'agit avant de lire un mot. Si la page pourrait appartenir à n'importe quel autre
> atelier, le travail n'est pas fait, même si elle est belle.

---

## 1. D'où viennent ces valeurs

Tout ce qui suit est relevé sur `azmotorsport.ca` le 2026-09-27, thème Shopify en
production. Rien n'est inventé. La provenance est indiquée à chaque fois, pour qu'une
session future puisse la revérifier au lieu de me croire.

| Valeur | Relevée où |
|---|---|
| Archivo | 7 déclarations `font-family` dans le thème |
| `#000000` / `#ffffff` | `--color-foreground` / `--color-background` |
| `#cefe01` | `--color-footer-link-hover`, et le monogramme |
| `#279a4b` | `--color-accent` du thème |
| `#f5f5f5` | fond des bandes claires du magasin |
| L'échelle de corps | `--size-hxl` à `--size-tiny` du thème |

---

## 2. La correction la plus importante

**Le magasin d'AZM n'est pas noir. Il est blanc, avec une chrome noire et des photos
sombres.** C'est la découverte qui change tout, et elle va à l'encontre de ce que la
landing fait aujourd'hui.

- `--color-background: 255 255 255` — le corps du magasin est **blanc**.
- Seules la barre du haut et le pied de page sont noirs (`--color-header-background`,
  `--color-footer-background`).
- La bannière d'accueil est sombre **parce que c'est une photographie** : un mur de
  brique portant l'enseigne AZ MOTORSPORT, prise en basse lumière. Le noir est un sujet,
  pas un aplat.
- En dessous, « BEST-SELLING DOWNPIPES » est une bande **claire**.
- Le lime n'apparaît que sur le monogramme, un lien actif, le numéro d'étape et le
  bouton principal. Compté sur l'accueil : **moins d'une dizaine d'occurrences**.

La landing, elle, est un aplat `#000` d'un bout à l'autre avec du lime partout. Ce n'est
pas la marque : c'est une extrapolation, et elle tombe précisément sur le défaut que la
skill `frontend-design` d'Anthropic liste en deuxième position — *« a near-black
background with a single bright acid-green accent »*.

**La règle qui en découle : le noir doit être porté par une image, pas par un aplat.**

### Mais la page reste sombre, et ce n'est pas de la paresse

En appliquant cette règle j'ai buté sur une contrainte d'actifs, relevée dans
`public/assets/brands/` : **quatre des neuf logos sont des silhouettes blanches.**
Ferrari (`fill="#fff"` partout) et Porsche (`fill="#ffffff"` unique) disparaîtraient
purement et simplement sur un fond clair ; McLaren, Audi et Corvette y perdraient une
partie de leur dessin. Les remettre en couleur voudrait dire redessiner des logos de
constructeurs, ce qui est aussi une question d'usage de marque.

**La grille de marques reste donc sur fond sombre.** Ce qui a changé, c'est que le
sombre n'est plus un vide : l'écran 01 ouvre sur une vraie photo d'AZM, et le reste de
la page descend de cette photo. C'est la règle appliquée dans les limites des actifs,
pas abandonnée.

Si un jour les neuf logos existent en version foncée, la grille peut passer sur clair
et la page suivra le rythme du magasin. C'est le seul verrou.

---

## 3. Couleur

| Rôle | Valeur | Emploi |
|---|---|---|
| Encre | `#000000` | texte sur clair, chrome (barre du haut, pied), fond des sections *photographiques* |
| Papier | `#ffffff` | fond par défaut du contenu |
| Surface claire | `#f5f5f5` | bandes alternées, cartes sur fond clair |
| Lime | `#cefe01` | **accent rare**, voir plafond ci-dessous |
| Vert | `#279a4b` | validation, stock, confirmation |
| Orange | `#f94c10` | alerte, erreur, mention hors-route |

**Plafond du lime : au plus trois emplois par écran**, et jamais deux côte à côte.
Le lime signale *l'action principale, l'étape en cours, la marque*. Rien d'autre. Un
lime qui sert aussi aux puces, aux filets, aux chiffres et aux libellés cesse de
signaler quoi que ce soit — c'est ce qui donne à une page l'air d'un thème.

Les gris se dérivent de l'encre, jamais d'une palette tierce : les neutres doivent se
lire comme choisis, pas empruntés.

---

## 4. Typographie

**Archivo, une seule famille.** C'est la police du magasin, elle est auto-hébergée par
`next/font`, et elle suffit : ses graisses vont de 400 à 900 et ses chiffres sont
tabulaires.

L'échelle est celle du thème, en rem :

```
hxl 4.0   h0 3.6   h1 3.2   h2 2.8   h3 2.2   h4 1.8
h5 1.6    h6 1.5   large 1.6   body 1.5   small 1.3   tiny 1.2
```

- **Titres** : italique, 900, capitales, interlettrage négatif. C'est la voix du magasin
  (« EUROPEAN BUILTS FOR PERFORMANCE », « BEST-SELLING DOWNPIPES »).
- **Données techniques** (prix, millésimes, codes châssis) : chiffres tabulaires. Pas de
  seconde famille monospace — un faux mono pour les petits libellés est un tic reconnu.
- **Longueur de ligne** : moins de 80 caractères.

---

## 5. La photographie est l'actif principal

AZM possède ce qu'aucun gabarit ne peut fabriquer : **des photos de chars de clients**,
prises par les clients, dans son atelier. 67 des 74 avis exploitables en portent une.
Plus les photos produit sur plaque de tôle larmée, et le mur de brique de l'enseigne.

**Toute section qui peut porter une photo réelle en porte une.** Une page qui montre
une M4 bleue devant l'atelier, une M8 rouge sur le dyno et une R8 blanche ne peut pas
ressembler à une autre page, parce que ces chars-là n'existent nulle part ailleurs.

Corollaire : **jamais d'illustration générique, d'icône décorative ni de dégradé en
remplacement d'une photo.** S'il n'y a pas d'image, la section reste en texte.

---

## 6. Structure et rythme

- **Alterner clair et sombre.** Le magasin le fait ; une page monotone se lit comme un
  gabarit. Le sombre arrive avec une image, le clair est l'état par défaut.
- **Un bord qui dessine une boîte autour du contenu est interdit.** Le groupement se
  fait par la proximité et le vide. Un bord n'est admis que s'il est un filet de
  séparation ou s'il appartient à un contrôle (bouton, champ, anneau de focus). Voir la
  section « Les bords » du README pour le détail de ce qui est parti et pourquoi.
- **Coupe d'angle** : `polygon(0 0, 100% 0, 100% calc(100% - Npx), calc(100% - Npx) 100%, 0 100%)`.
  C'est le motif du monogramme, et c'est la seule ornementation permise.
- **Casser le rythme au moins une fois par page.** Trois colonnes égales répétées trois
  fois de suite est la signature d'une page produite en série.

---

## 7. La liste noire

Ces motifs sont interdits **sauf si le contenu les exige réellement**. Chacun est un
signe reconnu de page générée ; ils viennent de la skill `frontend-design` d'Anthropic
et des relevés faits sur cette page.

| Interdit | Pourquoi | À la place |
|---|---|---|
| Libellé en CAPITALES espacées au-dessus d'un titre | « eyebrow » générique, et la page en empilait deux | Intégrer le mot important dans le titre |
| Deux « eyebrows » avant le même `<h1>` | Défaut cité tel quel | Une seule ligne, ou aucune |
| Chaînes méta jointes par des points médians (`A · B · C`) | Chrome de gabarit | Une phrase, ou des colonnes |
| `MOT — fragment` avec tiret cadratin espacé | Le signe le plus cité, avant même le visuel | Point, deux-points, parenthèse |
| Tiret cadratin dans la prose | Idem. La page en comptait 12, elle en compte 0 | Ponctuation normale |
| Numérotation `01 02 03` décorative | N'est légitime que si le contenu **est** une séquence | Les étapes du parcours : oui. La grille de marques : non |
| Faux monospace pour les petits libellés | Tic reconnu | Chiffres tabulaires d'Archivo |
| Cartes identiques en rangées de trois | La signature « SaaS » | Faire varier taille, contenu ou nombre |
| Aplat noir sans photographie | Le défaut n°2, et ce n'est pas la marque | Fond clair, ou noir porté par une image |
| Lime en accent partout | Un accent partout n'accentue rien | Trois emplois par écran au plus |
| Animation d'entrée sur chaque section | Défaut générique | Un seul moment orchestré, ou aucun |
| `→` accolé au texte d'un lien ou d'un bouton | Chrome de gabarit | Le verbe suffit |

---

## 8. La voix

Le ton du magasin est celui d'un atelier qui répond au téléphone, pas d'une marque qui
communique. Il est direct, technique, et il nomme les choses.

- **Le vocabulaire du métier, jamais paraphrasé** : downpipe, catless / catted, stage 2,
  code châssis, 304 stainless, TIG, bolt-on, off-road only.
- **Des chiffres réels, jamais ronds** : 4.9 sur 79 avis, 121 pièces, 99 châssis, 86 %
  de retours dus au fitment. Un chiffre rond se lit comme une estimation.
- **Dire non quand c'est non.** « If your car isn't on that line, don't buy. Call us
  instead. » C'est ce qui rend crédible le reste de la page.
- **Phrases courtes, voix active, casse de phrase.** Un bouton dit ce qui se passe.
- Une phrase qui pourrait décrire n'importe quel atelier est à réécrire ou à supprimer.

---

## 9. Vérifier, pas supposer

Un design ne se déclare pas fini, il se regarde.

```bash
npm run build && npm start
node tools/shot.mjs "?make=BMW&model=m3&year=2021&step=results"   # captures
npm run audit                                                     # débordements
```

À 320 et 390 px de viewport **réel**, Chrome headless de cette machine clampe la fenêtre
autour de 500 px : passer par `Emulation.setDeviceMetricsOverride` du protocole DevTools,
sinon on corrige des bogues qui n'existent pas et on en rate de vrais.

Avant de dire que c'est fait : capturer, regarder la capture, et se poser la question du
haut de ce fichier. Un inconnu saurait-il de quel commerce il s'agit ?
