'use client';

import { CURRENCIES } from '@/lib/currency';
import { setCurrency, useCurrency } from '@/lib/useCurrency';

/* Le choix de la monnaie, dans l'en-tête collant : visible à chaque étape (Sam, 27 nov.
   2026). Un vrai <select> : sur téléphone il ouvre la roue native, la plus facile à
   viser au pouce, et un lecteur d'écran l'annonce tel quel. */
export default function CurrencySelect() {
  const cur = useCurrency();
  return (
    <label className="cursel">
      <span className="srOnly">Currency</span>
      <select value={cur} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>
    </label>
  );
}
