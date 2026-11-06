'use client';

import dynamic from 'next/dynamic';

/* Le chat Tyler arrive APRÈS la page : chargé à part (next/dynamic) et jamais rendu
 * côté serveur (ssr: false). Le premier rendu et le LCP de l'écran des pièces n'en
 * paient rien. `ssr: false` n'est permis que dans un composant client, d'où ce fichier.
 */
const TylerChat = dynamic(() => import('./TylerChat'), { ssr: false });

export default TylerChat;
