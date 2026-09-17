import Link from 'next/link';
import { makeCards, partCount, modelCount } from '@/lib/catalog';

/* 01 — la marque.
 *
 * Entièrement rendu par le serveur. C'est là que se joue le gain du refactor : cet
 * écran ne faisait rien d'autre que boucler sur neuf marques, mais il attendait pour
 * ça que 280 ko de catalogue soient téléchargés, analysés et exécutés dans le
 * navigateur. Il arrive maintenant en HTML, et le catalogue ne quitte pas le serveur.
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
          </dl>
        </div>
      </div>

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
              <span className="brand-card__text">
                <span className="brand-card__name">{m.make}</span>
                <span className="brand-card__n">{m.parts} parts</span>
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="undertitle">Built by car enthusiasts, for car enthusiasts.</p>
    </section>
  );
}
