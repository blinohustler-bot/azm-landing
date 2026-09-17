import Image from 'next/image';

/* Le char de la marque reste en fond des écrans suivants : le visiteur garde son
 * véhicule sous les yeux pendant qu'il répond.
 *
 * L'image passe par next/image — servie en AVIF/WebP à la taille réellement affichée,
 * là où la page statique tirait le JPEG de collection en pleine résolution derrière un
 * simple ?width=1200, pour l'afficher ensuite à 16 % d'opacité.
 */
export default function ContextImage({ src }: { src: string | null }) {
  if (!src) return null;
  return (
    <div className="ctx" aria-hidden="true">
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        priority={false}
        /* Purement décoratif : jamais dans le chemin critique du premier rendu. */
        quality={55}
      />
    </div>
  );
}
