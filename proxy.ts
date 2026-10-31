import { NextResponse, type NextRequest } from 'next/server';
import { AB_COOKIE, AB_MAX_AGE, abValue, drawAb } from '@/lib/experiment';

/* Tire la version A/B à la première visite (voir lib/experiment.ts).
 *
 * Ça se fait ici et pas dans la page : un composant serveur ne peut pas écrire de
 * cookie. Le cookie est aussi posé sur la REQUÊTE, pour que la page rendue par cette
 * même requête voie déjà la version — sinon la première visite verrait A, puis B au
 * clic suivant.
 *
 * Pas httpOnly : le pixel Meta et Clarity le lisent dans le navigateur. Il ne contient
 * qu'un nom de version, rien de personnel.
 */
export function proxy(request: NextRequest) {
  if (abValue(request.cookies.get(AB_COOKIE)?.value)) return NextResponse.next();

  const ab = drawAb();
  if (!ab) return NextResponse.next();

  request.cookies.set(AB_COOKIE, ab);
  const res = NextResponse.next({ request: { headers: request.headers } });
  res.cookies.set(AB_COOKIE, ab, { path: '/', maxAge: AB_MAX_AGE, sameSite: 'lax', secure: true });
  return res;
}

/* La page seulement : ni l'API, ni les fichiers statiques, ni les images. */
export const config = {
  matcher: ['/']
};
