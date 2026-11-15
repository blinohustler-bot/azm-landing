import BfCountdown from './BfCountdown';
import { BFCM } from '@/lib/promo';

/* Le bloc Black Friday du hero : les trois paliers et le temps qui reste.
 *
 * Les paliers sont ceux que Shopify applique tout seul au checkout (10 % sur tout,
 * 15 % dès 2 000 $, 20 % dès 5 000 $ CA). La page ne calcule rien : elle annonce.
 * Coupe d'angle = le motif du monogramme, la seule ornementation permise.
 */
const TIERS = [
  { pct: '10%', when: 'on everything' },
  { pct: '15%', when: 'orders $2,000+' },
  { pct: '20%', when: 'orders $5,000+' }
] as const;

export default function BfOffer() {
  return (
    <div className="bfo" aria-label="Black Friday sale">
      <p className="bfo__title">
        <b>Black Friday.</b> Up to 20% off.
      </p>
      <ol className="bfo__tiers">
        {TIERS.map((t) => (
          <li key={t.pct}>
            <b>{t.pct}</b>
            <span>{t.when}</span>
          </li>
        ))}
      </ol>
      <p className="bfo__ends">
        Ends {BFCM.END_LABEL}, 11:59 PM ET. <BfCountdown className="cd--hero" /> left. Applied
        automatically at checkout.
      </p>
    </div>
  );
}
