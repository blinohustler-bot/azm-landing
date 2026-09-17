import Link from 'next/link';
import type { Generation, Model } from '@/lib/catalog';

/* 03 — la génération, sautée quand le modèle n'en a qu'une.
 *
 * Vérifié sur le catalogue : 81 modèles sur 99 n'ont qu'une génération, donc leur
 * demander l'année serait un clic pour rien. Les 18 autres sont les gros vendeurs
 * (M3, M5, 911 Turbo, GT3) où deux générations ne partagent aucune pièce — là, la
 * question est ce qui évite la mauvaise vente. L'aiguillage est dans app/page.tsx,
 * côté serveur : l'écran n'existe tout simplement pas quand il ne sert pas.
 */
export default function StepGeneration({
  make,
  model,
  generations
}: {
  make: string;
  model: Model;
  generations: Generation[];
}) {
  const base = `/?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model.key)}`;

  return (
    <section className="screen wrap wrap--narrow" aria-labelledby="step-title">
      <p className="rule">
        <b>03</b> Generation
      </p>
      <h1 id="step-title">Which {model.label}?</h1>
      <p className="sub">
        Your car was built in more than one shape, and they don&rsquo;t share a single part. Pick the
        years that match yours — the chassis code is on your registration.
      </p>

      <div className="choices choices--tight">
        {/* La plus récente en premier : c'est la plus probable. */}
        {generations
          .slice()
          .reverse()
          .map((g) => (
            <Link key={g.from} className="choice" href={`${base}&year=${g.from}`} scroll={false}>
              <span>
                {g.from}–{g.to}
              </span>
              <small>{g.chassis || `${g.products.length} parts`}</small>
            </Link>
          ))}
        <Link className="choice choice--plain" href={`${base}&step=missing`} scroll={false}>
          <span>Older / not sure</span>
        </Link>
      </div>
    </section>
  );
}
