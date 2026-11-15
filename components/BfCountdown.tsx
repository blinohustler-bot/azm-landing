'use client';

import { useEffect, useState } from 'react';
import { BFCM } from '@/lib/promo';

/* Le compte à rebours du Black Friday, jusqu'à BFCM.END (5 déc. 23 h 59 HE).
 *
 * Le serveur rend la valeur à l'heure de la requête ; le navigateur reprend ensuite
 * avec sa propre horloge, à la seconde. Les deux peuvent différer d'une seconde au
 * moment de l'hydratation : suppressHydrationWarning, c'est voulu.
 *
 * Une fois la vente finie, le composant ne rend plus rien (le bandeau, lui, rebascule
 * au prochain rendu serveur via isBfcm()).
 */
function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function BfCountdown({ className }: { className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = BFCM.END - now;
  if (left <= 0) return null;
  const { d, h, m, s } = parts(left);
  /* Un seul nœud texte : suppressHydrationWarning ne couvre que le texte direct de
     l'élément, pas des <b> enfants (sinon React régénère tout l'arbre au chargement). */
  const text = `${d > 0 ? `${d}d ` : ''}${pad(h)}h ${pad(m)}m ${pad(s)}s`;

  return (
    <span className={className ? `cd ${className}` : 'cd'} role="timer" suppressHydrationWarning>
      {text}
    </span>
  );
}
