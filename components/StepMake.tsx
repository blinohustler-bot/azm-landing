import Link from 'next/link';
import Stars from './Stars';
import QuoteRail from './QuoteRail';
import { makeCards, partCount, modelCount } from '@/lib/catalog';
import { featuredReviews, formatRating, PRODUCT_RATING, REVIEW_TOTALS } from '@/lib/reviews';
import { CONFIG } from '@/lib/config';

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
    <section className="screen wrap" aria-labelledby="step-title">
      {/* La note Google ouvre la page parce que c'est la seule preuve qui vaut avant
          que le visiteur ait dit quoi que ce soit sur sa voiture : elle couvre 100 %
          des arrivées, là où un avis produit n'en couvre que 38 %. */}
      <p className="authority">
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
        <i />
        <b>Official downpipe supplier for Stage 4 Tuning Canada</b>
        <i />
        <span>Canada&rsquo;s #1 choice for Euro &amp; Exotic</span>
      </p>
      <p className="rule">
        <b>01</b> Your car <span>· 6 sec</span>
      </p>

      <div className="intro">
        <h1 id="step-title">
          What are you
          <br />
          driving?
        </h1>
        <div className="intro__side">
          <p className="sub">
            <b>86% of parts returned online are simply the wrong fitment.</b> So we start with your
            chassis and finish by printing the exact years the part was built for. You check it
            yourself before you spend a dollar.
          </p>
        </div>
      </div>

      {/* La barre de chiffres traverse toute la largeur au lieu de tenir dans la
          colonne de droite : elle sépare le discours de la grille, et comble le vide
          que le titre laissait sous lui. */}
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

      <div className="brands">
        {cards.map((m, i) => (
          <Link
            key={m.slug}
            className="brand-card"
            data-brand={m.slug}
            href={`/?make=${encodeURIComponent(m.make)}`}
            scroll={false}
          >
            <span className="brand-card__idx" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
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

      {/* Les citations viennent APRÈS la grille, pas avant : l'écran a un seul travail,
          faire cliquer une marque, et rien ne doit repousser les tuiles sous la ligne
          de flottaison. Elles attrapent celui qui a hésité et fait défiler.

          Aucun de ces avis ne porte l'indicateur `verified` dans la source — on écrit
          donc « customer reviews », jamais « verified buyers ». */}
      {quotes.length ? (
        <QuoteRail quotes={quotes} rating={PRODUCT_RATING} count={REVIEW_TOTALS.reviews} />
      ) : null}

      <p className="undertitle">Built by car enthusiasts, for car enthusiasts.</p>
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
