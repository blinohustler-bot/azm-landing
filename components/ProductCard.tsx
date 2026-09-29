'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { CONFIG } from '@/lib/config';
import { track } from '@/lib/track';
/* catalogTypes, jamais catalog : ce fichier est 'use client', et lib/catalog importe
   catalog.json — 360 ko qui partiraient dans le bundle du navigateur. */
import { fitmentLines, money, type Product } from '@/lib/catalogTypes';

/* Le choix catless / catted n'est pas une option technique : c'est la question du son
   et de la légalité, celle qui bloque vraiment l'achat. On l'explique sous le
   sélecteur, en clair. */
function help(options: string[]) {
  const t = options.join(' ').toLowerCase();
  if (t.includes('catless') || t.includes('race')) {
    return (
      <>
        <b>Loudest, most aggressive.</b> No catalytic converters — off-road and competition use
        only, not legal on public roads.
      </>
    );
  }
  if (t.includes('catted') || t.includes('high flow')) {
    return (
      <>
        <b>Keeps the converters.</b> Calmer at cold start and easier to live with daily, still
        opens up the flow.
      </>
    );
  }
  return null;
}

export default function ProductCard({
  product,
  shop,
  partLabel,
  priority
}: {
  product: Product;
  shop: string;
  partLabel: string;
  priority: boolean;
}) {
  /* On garde l'index d'origine de chaque option.
     L'ancienne page filtrait « Title » puis indexait v.options avec la position dans
     le tableau *filtré* : dès que « Title » n'aurait pas été en dernier, le sélecteur
     aurait lu la mauvaise option. Ici l'index suit l'option, pas sa place à l'écran. */
  const opts = useMemo(
    () =>
      product.optionNames
        .map((name, i) => ({ name, i }))
        .filter((o) => o.name && o.name !== 'Title'),
    [product.optionNames]
  );

  const [chosen, setChosen] = useState<string[]>(() =>
    product.optionNames.map((_, i) => product.variants[0]?.options[i] ?? '')
  );

  const current = useMemo(() => {
    if (!opts.length) return product.variants[0];
    return (
      product.variants.find((v) => opts.every((o) => v.options[o.i] === chosen[o.i])) ??
      product.variants[0]
    );
  }, [chosen, opts, product.variants]);

  const tip = help(current?.options ?? []);
  const img = product.images[0];
  const fits = fitmentLines(product);

  const buyHref =
    `${shop}/cart/${current.id}:1?${CONFIG.UTM}&utm_content=${encodeURIComponent(product.handle)}`;
  const talkHref = CONFIG.TALK || CONFIG.PHONE_HREF;

  return (
    <article className="card">
      <div className="card__media">
        {img ? (
          <Image
            src={img}
            alt={product.title}
            fill
            sizes="(min-width:760px) 50vw, 100vw"
            /* La première carte est souvent le plus grand élément de l'écran de
               résultats : elle se charge en priorité, les suivantes paresseusement. */
            priority={priority}
            quality={72}
          />
        ) : null}
        <span className="card__tag">{partLabel}</span>
      </div>

      <div className="card__body">
        <h3>{product.title}</h3>

        {/* Le bloc de fitment attaque le frein n°1 du créneau : 86 % des retours de
            pièces en ligne sont un mauvais fitment. On l'imprime, on ne le cache pas. */}
        {fits.length ? (
          <div className="fitbox">
            <p className="fitbox__head">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Built for these exact cars
            </p>
            <p className="fitbox__body">{fits.join(' · ')}</p>
          </div>
        ) : null}

        {product.features.length ? (
          <ul className="specs">
            {product.features.slice(0, 3).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}

        {opts.length ? (
          <div className="opts">
            {opts.map((o) => {
              const values = Array.from(
                new Set(product.variants.map((v) => v.options[o.i]).filter(Boolean))
              );
              const id = `opt-${product.id}-${o.i}`;
              return (
                <div key={id}>
                  <label htmlFor={id}>{o.name}</label>
                  <select
                    id={id}
                    value={chosen[o.i] ?? ''}
                    onChange={(e) => {
                      const next = chosen.slice();
                      next[o.i] = e.target.value;
                      setChosen(next);
                    }}
                  >
                    {values.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              );
            })}
            {tip ? <p className="opt-help">{tip}</p> : null}
          </div>
        ) : null}

        <div className="price">
          <b>{money(current.price)}</b>
          <small>CAD</small>
          <span className={`stock ${current.available ? 'stock--in' : 'stock--out'}`}>
            {current.available ? 'In stock' : 'Built to order'}
          </span>
        </div>

        <div className="card__actions">
          {/* Le paiement reste entièrement chez Shopify : ce lien ouvre le panier sur
              azmotorsport.ca, aucune donnée de paiement ne passe par cette page. */}
          <a
            className="btn"
            href={buyHref}
            onClick={() =>
              track('AddToCart', {
                content_ids: [String(current.id)],
                content_name: product.title,
                value: current.price,
                currency: 'CAD'
              })
            }
          >
            Buy now
          </a>
          <a className="btn btn--ghost" href={talkHref}>
            Ask a builder
          </a>
        </div>

        {/* La mention off-road n'apparaît que si aucune option ne l'explique déjà :
            l'aide sous le sélecteur dit la même chose, en plus clair. */}
        {product.offroad && !opts.length ? (
          <p className="note">
            Race (catless) versions are for off-road / competition use only.
          </p>
        ) : null}
      </div>
    </article>
  );
}
