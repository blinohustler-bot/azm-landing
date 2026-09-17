'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import VehicleContext from './VehicleContext';

export type ModelChoice = {
  key: string;
  label: string;
  years: string;
  /* Les alias du catalogue (« r8-v10 ») ne s'affichent pas, mais rendent la recherche
     utile : on tape le code de sa voiture, pas toujours son nom commercial. */
  search: string;
};

/* 02 — le modèle.
 *
 * Le seul écran du parcours qui a besoin d'interactivité côté client, et seulement
 * au-delà de douze modèles : en dessous, la liste tient à l'écran et un champ de
 * recherche serait une étape de plus pour rien. Le serveur n'envoie que les modèles
 * d'une seule marque — une trentaine d'entrées, pas le catalogue.
 */
export default function StepModel({
  make,
  models,
  parts
}: {
  make: string;
  models: ModelChoice[];
  parts: number;
}) {
  const [q, setQ] = useState('');
  const withSearch = models.length >= 12;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return models;
    return models.filter(
      (m) => m.label.toLowerCase().includes(needle) || m.search.includes(needle)
    );
  }, [q, models]);

  const base = `/?make=${encodeURIComponent(make)}`;

  return (
    /* Pleine largeur : une colonne de 880 px centrée laissait deux grandes marges
       vides de part et d'autre d'une grille de quinze modèles. */
    <section className="screen wrap" aria-labelledby="step-title">
      <p className="rule">
        <b>02</b> Model
      </p>
      <VehicleContext make={make} parts={parts} models={models.length} />
      <h1 id="step-title">Which {make}?</h1>
      <p className="sub">
        If yours isn&rsquo;t on the list, we don&rsquo;t build for it yet — say so and you&rsquo;ll
        get a straight answer instead of a maybe.
      </p>

      {withSearch ? (
        <>
          <label className="srOnly" htmlFor="model-search">
            Filter {make} models
          </label>
          <input
            className="search"
            id="model-search"
            type="search"
            placeholder="Type your model…"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </>
      ) : null}

      <div className="choices">
        {shown.map((m) => (
          <Link
            key={m.key}
            className="choice"
            href={`${base}&model=${encodeURIComponent(m.key)}`}
            scroll={false}
          >
            <span>{m.label}</span>
            {m.years ? <small>{m.years}</small> : null}
          </Link>
        ))}
        {shown.length === 0 ? (
          <p className="choices__empty">
            Nothing matches “{q.trim()}”. Clear the search, or tell us about your car below.
          </p>
        ) : null}
        <Link className="choice choice--plain" href={`${base}&step=missing`} scroll={false}>
          <span>My model isn&rsquo;t listed</span>
        </Link>
      </div>

      {/* aria-live : la liste change sous un champ de recherche, et un lecteur d'écran
          n'a autrement aucun moyen de savoir combien de résultats il reste. */}
      <p className="srOnly" role="status" aria-live="polite">
        {shown.length} {shown.length === 1 ? 'model' : 'models'} shown
      </p>
    </section>
  );
}
