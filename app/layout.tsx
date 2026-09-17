import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import Script from 'next/script';
import { CONFIG } from '@/lib/config';
import LandingCapture from '@/components/LandingCapture';
import './globals.css';

/* Archivo, auto-hébergée par next/font : la page tirait jusqu'ici une feuille de style
   Google Fonts bloquante, plus deux préconnexions, pour deux familles. Une seule
   famille, servie depuis notre origine, sans requête tierce et sans FOUT — la CSP peut
   du même coup interdire fonts.gstatic.com. */
const archivo = Archivo({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-archivo'
});

export const metadata: Metadata = {
  title: 'AZ Motorsport — Find the exact parts that fit your car',
  description:
    'Pick your make, model and generation. We show the exact AZ Motorsport downpipes and exhaust built for your chassis — real prices, real stock, printed fitment.',
  /* Page de campagne : elle vit derrière une pub, pas dans les résultats de recherche. */
  robots: { index: false, follow: false },
  icons: { icon: '/assets/azm-mark.png' }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        {/* Retient l'URL d'arrivée avant que le parcours ne la remplace. */}
        <LandingCapture />
        {children}

        <footer>
          <div className="wrap">
            <p>Prices in CAD, pulled live from azmotorsport.ca · checkout happens on azmotorsport.ca</p>
            {/* Mention d'usage des marques : obligatoire dès qu'on affiche les logos des
                constructeurs. C'est la formule que le créneau utilise (Fabspeed, ECS). */}
            <p>
              All manufacturer names, symbols and descriptions are used for identification purposes
              only. AZ Motorsport is not affiliated with, nor endorsed by, these manufacturers.
            </p>
          </div>
        </footer>

        {/* Le pixel se charge après l'hydratation : il ne doit jamais retarder le
            premier écran, qui est ce que la pub a payé pour montrer. */}
        {CONFIG.PIXEL ? (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,
'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${CONFIG.PIXEL}');fbq('track','PageView');`}
          </Script>
        ) : null}
      </body>
    </html>
  );
}
