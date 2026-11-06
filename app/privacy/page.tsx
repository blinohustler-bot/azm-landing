import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

/* Politique de confidentialité de la landing. Elle couvre ce que cette page collecte,
 * et surtout le programme de textos : la vérification A2P refuse une politique sans
 * section SMS ni engagement de non-partage des numéros. */
export const metadata: Metadata = {
  title: 'Privacy Policy | AZ Motorsport',
  robots: { index: false, follow: true }
};

export default function Privacy() {
  return (
    <main className="screen wrap wrap--narrow legalpage">
      <p className="rule"><b>Legal</b> Privacy policy</p>
      <h1>Privacy Policy</h1>
      <p className="sub">
        {LEGAL.brand} is operated by {LEGAL.entity}, {LEGAL.address}. This policy explains what
        we collect on fitment.azmotorsport.ca, how we use it, and your choices. Effective {LEGAL.effective}.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Contact details you give us: your name, email address and mobile phone number.</li>
        <li>Your vehicle: make, model and year or generation, and the parts shown for it.</li>
        <li>Your text-message choice: whether you checked the SMS consent box, with the date and time.</li>
        <li>
          Usage data collected automatically: pages viewed, clicks, device and browser type, and the
          ad or link that brought you here.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To send your fitment sheet and confirm which parts fit your vehicle.</li>
        <li>To answer your questions, prepare quotes, and process and support your order and install.</li>
        <li>If you opted in, to send you text messages as described in our <Link href="/terms">Terms of Service</Link>.</li>
        <li>To improve this site and measure our advertising.</li>
      </ul>

      <h2>Text messages (SMS)</h2>
      <p>
        We only text you if you checked the SMS consent box on our form. The box is never pre-checked and
        is not required to see your parts or to buy. Message frequency varies. Message and data rates may
        apply. Reply STOP to opt out at any time, or HELP for help. Full details are in our{' '}
        <Link href="/terms">Terms of Service</Link>.
      </p>
      <p className="strong">
        We do not sell, rent or share your mobile phone number, or your SMS opt-in data and consent, with
        any third parties or affiliates for their marketing or promotional purposes. Text messaging opt-in
        data and consent are never shared with third parties, except the providers that deliver our text
        messages.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        This site uses cookies and similar technologies, including the Meta Pixel and Microsoft Clarity, to
        understand how visitors use the page and to measure our ads. You can block or delete cookies in your
        browser settings. The site still works without them.
      </p>

      <h2>Who processes your data</h2>
      <p>
        We use service providers to run our business: our customer relationship and messaging platform, our
        email platform, our online store (Shopify), and our analytics and advertising tools. They process
        data on our behalf and only for the purposes above.
      </p>

      <h2>Data security</h2>
      <p>
        Data is sent over encrypted connections (HTTPS) and stored with providers that use industry-standard
        security. Access is limited to the people who need it to serve you. No method of transmission or
        storage is perfectly secure, but we take reasonable measures to protect your information.
      </p>

      <h2>How long we keep it</h2>
      <p>We keep your information as long as needed to serve you and to meet legal and tax obligations.</p>

      <h2>Your rights</h2>
      <ul>
        <li>Ask to access, correct or delete your personal information.</li>
        <li>Stop text messages at any time by replying STOP.</li>
        <li>Unsubscribe from emails with the link in any email.</li>
        <li>Update your information or withdraw consent by contacting us.</li>
      </ul>

      <h2>Age</h2>
      <p>This site and our text messages are intended for people 18 years of age or older.</p>

      <h2>Contact</h2>
      <p>
        Privacy questions or requests: {LEGAL.email} or {LEGAL.phone}. {LEGAL.entity}, {LEGAL.address}.
      </p>

      <p className="legalpage__back"><Link href="/">← Back to fitment</Link> · <Link href="/terms">Terms of Service</Link></p>
    </main>
  );
}
