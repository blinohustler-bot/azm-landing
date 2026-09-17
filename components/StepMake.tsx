import Link from 'next/link';
import { makeCards, partCount, modelCount } from '@/lib/catalog';

/* 01 — la marque.
 *
 * Entièrement rendu par le serveur : cet écran ne fait que boucler sur neuf marques,
 * mais il attendait pour ça que 280 ko de catalogue soient téléchargés, analysés et
 * exécutés dans le navigateur. Il arrive maintenant en HTML.
 *
 * Les cartes sont des liens, plus des boutons : une étape = une URL. Elles marchent
 * donc au clavier, au clic du milieu, au clic droit « ouvrir dans un nouvel onglet »,
 * et avant même que le JavaScript n'ait fini de charger.
 */
export default function StepMake() {
  const cards = makeCards();

  return (
    <section className="screen wrap" aria-labelledby="step-title">
      <p className="authority">
        <b>Official downpipe supplier — Stage 4 Tuning Canada</b>
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
            chassis and finish by printing the exact years the part was built for — you check it
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
            /* La première porte le plus gros catalogue : elle prend deux colonnes.
               La grille dit ce que le catalogue dit. */
            className={`brand-card${i === 0 ? ' brand-card--lead' : ''}`}
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
                {/* Visible seulement sur la carte large — ailleurs le CSS la masque,
                    parce qu'elle y écraserait le nom. */}
                <span className="brand-card__models">{m.models.join(' · ')}</span>
                <span className="brand-card__n">
                  <b>{m.parts}</b>
                  <span>parts</span>
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="undertitle">Built by car enthusiasts, for car enthusiasts.</p>
    </section>
  );
}
