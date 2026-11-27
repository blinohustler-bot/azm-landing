import Link from 'next/link';
import { CONFIG, STEP_INDEX, TOTAL_STEPS, type StepName } from '@/lib/config';
import { freeShipMin, isBfcm } from '@/lib/promo';
import BfCountdown from './BfCountdown';
import CurrencySelect from './CurrencySelect';

/* La barre du haut et la barre de progression.
 *
 * Le retour était un bouton piloté par un tableau `trail` maison, qui doublait
 * l'historique du navigateur et s'en désynchronisait dès qu'on touchait au bouton
 * « précédent » du téléphone. Chaque étape ayant maintenant sa propre URL, c'est un
 * vrai lien vers l'étape précédente : il marche au clavier, au clic-droit, et le
 * bouton du navigateur fait la même chose.
 */

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export function Header({ backHref }: { backHref: string | null }) {
  return (
    <header className="top">
      {/* Le bandeau de livraison est dans l'en-tête collant : il reste visible à chaque
          étape, y compris sur l'écran des pièces où se décide le checkout. */}
      {/* Pendant le Black Friday (lib/promo.ts), le bandeau annonce la vente à tout le
          monde ; seule la partie livraison garde .shipfree (cachée hors Canada/USA). */}
      {/* Le bandeau BF est un aplat lime : c'est voulu, et c'est la seule exception au
          plafond du lime (DESIGN.md §3). Une ligne grise de 12 px ne se voyait pas
          (Sam, 15 nov. 2026) : pendant trois semaines, la vente EST le message. */}
      {isBfcm() ? (
        <p className="shipbar shipbar--bf">
          <b>Black Friday</b>
          <span className="bfbar__deal">Up to 20% off</span>
          <span className="bfbar__ends">
            Ends in <BfCountdown />
          </span>
          <span className="shipfree bfbar__ship">
            Free shipping over ${freeShipMin().toLocaleString('en-US')} CA &amp; US
          </span>
        </p>
      ) : (
        <p className="shipbar shipfree">
          <b>Free shipping</b> over ${freeShipMin().toLocaleString('en-US')} · Canada &amp; US
        </p>
      )}
      <div className="wrap top__in">
        {/* Le logo ramène au choix de la marque (écran 01). Clarity montrait des clics
            morts dessus : on s'attend à ce qu'un logo ramène au début (Sam, 27 nov. 2026). */}
        <Link className="brand" href="/">
          {/* Le monogramme est décoratif : le nom est écrit juste à côté. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/azm-mark.png" alt="" width={28} height={28} />
          AZ Motorsport
        </Link>
        <span className="top__spacer" />
        <CurrencySelect />
        <a className="phone" href={CONFIG.PHONE_HREF}>
          <PhoneIcon />
          {/* Sur téléphone, l'icône seule : le sélecteur de monnaie prend la place du
              numéro, et le lien appelle toujours au toucher. */}
          <span className="phone__n">{CONFIG.PHONE}</span>
        </a>
        {backHref ? (
          <Link className="back" href={backHref} scroll={false}>
            ← Back
          </Link>
        ) : null}
      </div>
    </header>
  );
}

export function Progress({ step }: { step: StepName }) {
  const n = STEP_INDEX[step];
  const pct = (n / TOTAL_STEPS) * 100;
  return (
    <div
      className="bar"
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-valuenow={n}
      aria-valuetext={`Step ${n} of ${TOTAL_STEPS}`}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
