import { slugify } from '@/lib/catalogTypes';

/* Le bandeau de contexte : la marque choisie, et où on en est.
 *
 * Les écrans 02 à 04 ne montraient rien de la voiture en cours — on venait de cliquer
 * Porsche et l'écran suivant n'en portait aucune trace, juste un titre et une grille.
 * C'est ce qui donnait à ces pages leur air de gabarit : elles auraient pu appartenir
 * à n'importe quel site.
 *
 * Le logo est repris tel quel de la grille précédente : le geste se prolonge, et la
 * personne voit que le système l'a suivie.
 */
export default function VehicleContext({
  make,
  parts,
  models,
  detail
}: {
  make: string;
  /* Nombre de pièces au catalogue pour cette marque. */
  parts: number;
  /* Nombre de châssis couverts. */
  models: number;
  /* Le modèle ou la génération déjà choisis, quand il y en a. */
  detail?: string | null;
}) {
  return (
    <div className="vctx">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vctx__logo" alt="" src={`/assets/brands/${slugify(make)}.svg`} />
      <div className="vctx__text">
        <p className="vctx__make">{make}</p>
        <p className="vctx__meta">
          {detail ? (
            <>
              <b>{detail}</b>
              <i />
            </>
          ) : null}
          {parts} parts · {models} {models === 1 ? 'chassis' : 'chassis'}
        </p>
      </div>
    </div>
  );
}
