import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

/* Conditions du programme de textos. Chaque section répond à un point de la
 * vérification A2P : description, STOP, HELP / contact, tarifs, transporteurs, 18+,
 * lien vers la politique de confidentialité. */
export const metadata: Metadata = {
  title: 'SMS Terms | AZ Motorsport',
  robots: { index: false, follow: true }
};

export default function Terms() {
  return (
    <main className="screen wrap wrap--narrow legalpage">
      <p className="rule"><b>Legal</b> SMS terms</p>
      <h1>SMS Terms</h1>
      <p className="sub">
        Terms for the {LEGAL.brand} text message program, operated by {LEGAL.entity}. Effective {LEGAL.effective}.
      </p>

      <h2>The program</h2>
      <p>
        When you check the SMS consent box on our fitment form, {LEGAL.brand} sends you text messages about
        your vehicle: your fitment sheet, replies to your questions about your build, quotes, order and
        install updates, and occasional offers. Consent is not a condition of purchase and is not required to
        see your parts.
      </p>

      <h2>Frequency and cost</h2>
      <p>Message frequency varies. Message and data rates may apply, depending on your mobile plan.</p>

      <h2>How to stop</h2>
      <p>
        Text STOP to cancel at any time. You will receive one final message confirming you are unsubscribed,
        and no more messages after that. To join again, check the consent box on our form again.
      </p>

      <h2>Help and support</h2>
      <p>
        Text HELP for help, email {LEGAL.email}, or call {LEGAL.phone}.
      </p>

      <h2>Carriers</h2>
      <p>Mobile carriers are not liable for delayed or undelivered messages.</p>

      <h2>Eligibility</h2>
      <p>You must be 18 years of age or older and the account holder, or have the account holder's permission, to join.</p>

      <h2>Privacy</h2>
      <p>
        We do not share your mobile number or SMS opt-in data with third parties for their marketing. Read
        our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Contact</h2>
      <p>{LEGAL.entity}, {LEGAL.address}. {LEGAL.email} · {LEGAL.phone}</p>

      <p className="legalpage__back"><Link href="/">← Back to fitment</Link> · <Link href="/privacy">Privacy Policy</Link></p>
    </main>
  );
}
