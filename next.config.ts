import type { NextConfig } from 'next';

/* Les en-têtes vivaient dans vercel.json tant que la page était statique. Ils sont
   ici maintenant : une seule source, et ils s'appliquent aussi en `next dev`, là où
   une CSP cassée se voit tout de suite plutôt qu'en production. */
const csp = [
  "default-src 'self'",
  /* 'unsafe-inline' reste nécessaire pour le script du pixel Meta, qui s'injecte
     lui-même. Tout le reste du JS est servi par Next depuis notre propre origine. */
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https://cdn.shopify.com https://www.facebook.com https://connect.facebook.net",
  "connect-src 'self' https://www.facebook.com https://connect.facebook.net",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'"
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /* Les photos produit viennent du CDN Shopify. next/image les sert en AVIF/WebP à la
     taille réellement affichée : la page en chargeait jusqu'ici huit en pleine
     résolution derrière un simple ?width=900. */
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }],
    formats: ['image/avif', 'image/webp'],
    /* Next 16 refuse par un 400 toute qualité non déclarée ici — y compris celles
       passées en prop. 75 est la valeur par défaut, 72 celle des photos produit, 55
       celle du fond contextuel, qui s'affiche à 16 % d'opacité derrière un dégradé et
       n'a besoin de rien de plus. Retirer une valeur d'ici casse l'image qui s'en
       sert, silencieusement en développement et visiblement en production. */
    qualities: [55, 72, 75]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
          { key: 'Content-Security-Policy', value: csp }
        ]
      },
      {
        /* Les logos et le monogramme ne changent qu'au rythme d'un dépôt de fichier.
           Next met déjà ses propres bundles en cache immuable ; public/ non. */
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, immutable' }]
      }
    ];
  }
};

export default nextConfig;
