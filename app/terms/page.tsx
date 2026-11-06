import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

/* Conditions du programme de textos. Chaque section répond à un point de la
 * vérification A2P : description, STOP, HELP / contact, tarifs, transporteurs, 18+,
 * lien vers la politique de confidentialité. */
export const metadata: Metadata = {
  title: 'Terms of Service | AZ Motorsport',
  robots: { index: false, follow: true }
};

export default function Terms() {
  return (
    <main className="screen wrap wrap--narrow legalpage">
      <p className="rule"><b>Legal</b> Terms of service</p>
      <h1>Terms of Service</h1>
      <p className="sub">
        Terms of Service for fitment.azmotorsport.ca and the {LEGAL.brand} SMS text message program, operated by {LEGAL.entity}. Effective {LEGAL.effective}.
      </p>

      <h2>SMS program description</h2>
      <p>
        When you check the SMS consent box on our fitment form, {LEGAL.brand} sends you text messages about
        your vehicle: your fitment sheet, replies to your questions about your build, quotes, order and
        install updates, and occasional offers. Consent is not a condition of purchase and is not required to
        see your parts.
      </p>

      <h2>Message frequency and message and data rates</h2>
      <p>Message frequency varies. Message and data rates may apply, depending on your mobile carrier plan.</p>

      <h2>How to opt out (Text STOP)</h2>
      <p>
        Text STOP to cancel at any time. You will receive one final message confirming you are unsubscribed,
        and no more messages after that. To join again, check the consent box on our form again.
      </p>

      <h2>Support contact information (Text HELP)</h2>
      <p>
        Text HELP for help, email {LEGAL.email}, or call {LEGAL.phone}.
      </p>

      <h2>Carrier liability</h2>
      <p>Mobile carriers are not liable for delayed or undelivered messages.</p>

      <h2>Age restriction (18+)</h2>
      <p>You must be 18 years of age or older and the account holder, or have the account holder's permission, to join.</p>

      <h2>Privacy Policy</h2>
      <p>
        We do not share your mobile number or SMS opt-in data with third parties for their marketing. Read
        our Privacy Policy at <Link href="/privacy">fitment.azmotorsport.ca/privacy</Link>.
      </p>

      <h2>Contact</h2>
      <p>{LEGAL.entity}, {LEGAL.address}. {LEGAL.email} · {LEGAL.phone}</p>

      <p className="legalpage__back"><Link href="/">← Back to fitment</Link> · <Link href="/privacy">Privacy Policy</Link></p>
    </main>
  );
}
