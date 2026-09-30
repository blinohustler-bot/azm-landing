import Link from 'next/link';
import Image from 'next/image';
import Stars from './Stars';
import QuoteRail from './QuoteRail';
import { makeCards, partCount, modelCount } from '@/lib/catalog';
import { featuredReviews, formatRating, PRODUCT_RATING, REVIEW_TOTALS } from '@/lib/reviews';
import { CONFIG, HERO, TOTAL_STEPS } from '@/lib/config';

/* 01 — la marque.
 *
 * Entièrement rendu par le serveur : cet écran ne fait que boucler sur neuf marques,
 * mais il attendait pour ça que 280 ko de catalogue soient téléchargés, analysés et
 * exécutés dans le navigateur. Il arrive maintenant en HTML.
 *
 * Les cartes sont des liens, plus des boutons : une étape = une URL. Elles marchent
 * donc au clavier, au clic du milieu, au clic droit « ouvrir dans un nouvel onglet »,
 * et avant même que le JavaScript n'ait fini de charger.
 *
 * DEUX PREUVES, DEUX ORIGINES, DEUX LIBELLÉS. La note Google en tête parle du
 * commerce ; les citations en bas viennent des avis déposés sur azmotorsport.ca et
 * parlent d'une pièce précise. Les mélanger sous le mot « Google » serait une fausse
 * indication d'origine — voir l'en-tête de lib/reviews.ts.
 */
export default function StepMake() {
  const cards = makeCards();
  const quotes = featuredReviews();

  return (
    <section className="screen screen--hero" aria-labelledby="step-title">
      {/* LE NOIR VIENT D'UNE PHOTO, PAS D'UN APLAT.
       *
       * L'écran ouvrait sur un vide noir avec un titre posé dessus — le fond que
       * n'importe quelle page produit par défaut. Il ouvre maintenant sur une vraie
       * photo d'AZM : une GT3 qui crache une flamme bleue dans une station-service.
       * C'est leur photo, c'est leur pièce qui fait ça, et aucune autre page au monde
       * ne l'a. Elle dormait à 16 % d'opacité derrière les écrans suivants.
       *
       * Une seule ligne de crédibilité au-dessus du titre. Il y en avait deux empilées
       * — la ligne Google et « 01 Your car · 6 sec » —, et deux libellés à la file
       * au-dessus d'un grand titre sont un motif de gabarit. Le numéro d'étape est
       * déjà porté par la barre de progression, en haut de la page. */}
      <div className="hero">
        {/* La photo vit dans son propre cadre, et pas en fond de la section, parce que
            les deux mises en page dont on a besoin ne sont pas la même. Large, le texte
            se pose DESSUS : il y a de la place dans la zone sombre à gauche. Étroit,
            la superposition ne marche plus — la source est un portrait 2:3, un bandeau
            de 390 px de large montre surtout le toit de la station, et le titre
            s'assoyait sur la voiture. Le cadre passe alors au-dessus du texte, les deux
            se lisent, et personne ne perd. */}
        <div className="hero__frame">
          <Image
            className="hero__shot"
            src={HERO.SRC}
            alt={HERO.ALT}
            fill
            sizes="100vw"
            priority
            quality={72}
          />
        </div>
        <div className="hero__in wrap">
          <a className="gsig" href={CONFIG.GOOGLE.URL} target="_blank" rel="noopener noreferrer">
            <GoogleG />
            <Stars rating={CONFIG.GOOGLE.RATING} decorative />
            <b className="gsig__rate">{formatRating(CONFIG.GOOGLE.RATING)}</b>
            {/* Les deux libellés partent dans le HTML et le CSS en cache un : la coupe
                dépend de la largeur, pas d'une mesure JavaScript, donc rien ne saute
                après l'hydratation sur l'élément le plus haut de la page. */}
            <span className="gsig__n gsig__n-long">{CONFIG.GOOGLE.COUNT} Google reviews</span>
            <span className="gsig__n gsig__n-short">{CONFIG.GOOGLE.COUNT} reviews</span>
          </a>

          <h1 id="step-title">
            What are you
            <br />
            driving?
          </h1>

          {/* CE QU'ON PROMET, PAS CE QU'ON EVITE.
           *
           * L'accroche ouvrait sur « 86 % des pièces retournées en ligne sont un
           * mauvais fitment ». Le chiffre est vrai et c'est la raison d'être du
           * sélecteur, mais c'est une perte, pas un gain : on faisait penser au
           * retour avant même d'avoir donné envie de la pièce.
           *
           * Le mécanisme ne bouge pas — on montre toujours les seules pièces
           * construites pour le châssis, millésimes imprimés. C'est le cadrage qui
           * change : le désir d'abord (le son, c'est ce qu'on achète), puis la
           * demande, puis ce qu'on en fait.
           *
           * AUCUNE MENTION DE STOCK ICI. Le stock bouge, et cette page est servie
           * depuis un catalog.json régénéré à la main : une promesse de disponibilité
           * dans l'accroche serait périmée sans que personne ne s'en aperçoive. La
           * disponibilité se dit sur la carte produit, où elle vient de la donnée.
           *
           * Le chiffre n'est pas perdu : il porte le bloc « The fitment is printed »
           * de l'écran de résultats, où il rassure au lieu d'inquiéter. */}
          <p className="sub">
            <b>The sound it should have come with.</b> Tell us what you drive. We point you to
            the downpipes and exhaust systems built for your exact chassis, with the years they
            fit printed on every part.
          </p>
        </div>
      </div>

      <div className="wrap">
      {/* LA QUESTION, JUSTE AU-DESSUS DES RÉPONSES.
       *
       * Le hero pleine hauteur avait repoussé la grille sous la ligne de flottaison :
       * on arrivait sur une belle photo et on ne voyait plus qu'il y avait quelque
       * chose à remplir. Un écran qui pose une question doit montrer ses réponses.
       *
       * Cette ligne fait le travail que faisait « 01 Your car · 6 sec » au-dessus du
       * titre, mais à l'endroit où elle sert : collée aux tuiles. Et elle porte une
       * vraie information — où on en est dans le parcours — au lieu d'un numéro
       * décoratif. */}
      <div className="ask">
        <h2 className="ask__q">Pick your make</h2>
        <p className="ask__step">
          Step 1 of {TOTAL_STEPS}
        </p>
      </div>

      {/* Plus de numéro d'ordre sur les tuiles. Neuf marques ne sont pas une séquence :
          on ne choisit pas BMW « avant » Porsche. Un `01 02 03` posé sur du contenu qui
          n'est pas une suite est de l'ornement, et c'est un des motifs qui font qu'une
          page se lit comme produite en série. Le nombre de pièces, lui, reste : c'est
          la donnée qui classe réellement les tuiles. */}
      <div className="brands">
        {cards.map((m) => (
          <Link
            key={m.slug}
            className="brand-card"
            data-brand={m.slug}
            href={`/?make=${encodeURIComponent(m.make)}`}
            scroll={false}
          >
            <span className="brand-card__label">
              {/* Logo officiel, fond retiré et viewBox recadré. next/image n'apporte
                  rien sur un SVG — il ne le redimensionne pas — et lui ferait perdre
                  sa mise à l'échelle fluide, qui est ici tout le sujet. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-card__logo" alt="" src={`/assets/brands/${m.slug}.svg`} />
              <span className="brand-card__foot">
                <span className="brand-card__name">{m.make}</span>
                <span className="brand-card__n">
                  <b>{m.parts}</b>
                  <span>parts</span>
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* La barre de chiffres est passée APRÈS la grille. Entre le titre et les tuiles
          elle coûtait 130 px de hauteur au-dessus de la ligne de flottaison, et elle
          n'a jamais fait cliquer personne : c'est de la réassurance, elle se lit après
          le geste, pas avant. */}
      <dl className="facts">
        <div>
          <dt>In the catalog</dt>
          <dd>{partCount} parts</dd>
        </div>
        <div>
          <dt>Chassis covered</dt>
          <dd>{modelCount} models</dd>
        </div>
        <div>
          <dt>Material</dt>
          <dd>304 stainless</dd>
        </div>
        <div>
          <dt>Fitment</dt>
          <dd>Printed per part</dd>
        </div>
      </dl>

      {/* Les citations viennent APRÈS la grille, pas avant : l'écran a un seul travail,
          faire cliquer une marque, et rien ne doit repousser les tuiles sous la ligne
          de flottaison. Elles attrapent celui qui a hésité et fait défiler.

          Aucun de ces avis ne porte l'indicateur `verified` dans la source — on écrit
          donc « customer reviews », jamais « verified buyers ». */}
      {quotes.length ? (
        <QuoteRail quotes={quotes} rating={PRODUCT_RATING} count={REVIEW_TOTALS.reviews} />
      ) : null}

      <p className="undertitle">Built by car enthusiasts, for car enthusiasts.</p>
      </div>
    </section>
  );
}

/* Le G officiel, aux quatre couleurs de Google. Les directives de marque de Google
   demandent le logo non modifié dès qu'on cite une note Google — un G monochrome
   redessiné serait à la fois hors règles et moins crédible : c'est le logo, et pas le
   mot, qui dit au visiteur que le chiffre vient d'ailleurs que de nous. */
function GoogleG() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
