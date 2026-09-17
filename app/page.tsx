import { cookies } from 'next/headers';
import { Header, Progress } from '@/components/Chrome';
import ContextImage from '@/components/ContextImage';
import StepMake from '@/components/StepMake';
import StepModel, { type ModelChoice } from '@/components/StepModel';
import StepGeneration from '@/components/StepGeneration';
import StepGate from '@/components/StepGate';
import StepResults from '@/components/StepResults';
import StepMissing from '@/components/StepMissing';
import StepThanks from '@/components/StepThanks';
import LeadRetry from '@/components/LeadRetry';
import Track from '@/components/Track';
import { CONFIG, type StepName } from '@/lib/config';
import { LEAD_COOKIE } from '@/lib/sendLead';
import {
  SHOP, findMake, findModel, findGeneration, partsFor, carName, generationLabel
} from '@/lib/catalog';

/* Le parcours, décidé côté serveur à partir de l'URL.
 *
 *   01 marque  →  02 modèle  →  03 génération*  →  04 coordonnées  →  les pièces
 *
 * * l'étape 3 n'existe que quand elle sert : 81 modèles sur 99 n'ont qu'une seule
 *   génération, et la demander serait un clic pour rien.
 *
 * Les sept écrans étaient auparavant sept <section> empilées dans le même document,
 * masquées en display:none, et un tableau `trail` maison tenait lieu d'historique.
 * Chaque étape a maintenant son URL : le bouton « précédent » du navigateur marche,
 * une pub peut viser un modèle précis, et le serveur n'envoie que l'écran demandé.
 */

type Params = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/* Ce qu'un lecteur d'écran entend quand l'étape change. Le titre visible le dit déjà
   pour qui regarde ; sans cette annonce, la navigation resterait muette, parce que
   changer d'étape ne recharge plus la page. */
const STEP_LABEL: Record<StepName, string> = {
  make: 'Step 1 of 5 — pick your make',
  model: 'Step 2 of 5 — pick your model',
  generation: 'Step 3 of 5 — pick your generation',
  gate: 'Step 4 of 5 — where to send your fitment sheet',
  results: 'Step 5 of 5 — the parts that fit',
  missing: 'Tell us about your car',
  thanks: 'Received'
};

export default async function Page({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const qs = {
    make: one(sp.make),
    model: one(sp.model),
    year: one(sp.year),
    step: one(sp.step),
    car: one(sp.car)
  };

  const make = findMake(qs.make);
  const model = findModel(make?.make, qs.model);
  const gen = findGeneration(model, qs.year);

  /* « Ce visiteur a déjà laissé ses coordonnées ». Un cookie, donc lisible ici : le
     client revient directement sur ses pièces, sans voir le formulaire clignoter le
     temps que le navigateur lise son localStorage. Ce n'est pas une barrière de
     sécurité — le gate est un dispositif de conversion, et l'a toujours été. */
  const known = (await cookies()).get(LEAD_COOKIE)?.value === '1';

  const needsGeneration = Boolean(model && model.generations.length > 1);
  const parts = partsFor(model, gen);

  /* ── quel écran ─────────────────────────────────────────────────────────── */
  let step: StepName;
  if (qs.step === 'thanks') step = 'thanks';
  else if (qs.step === 'missing') step = 'missing';
  else if (CONFIG.GATE_FIRST && !known) step = 'gate';
  else if (!make) step = 'make';
  else if (!model) step = 'model';
  else if (needsGeneration && !gen) step = 'generation';
  else if (parts.length === 0) step = 'missing';
  else if (known || qs.step === 'results') step = 'results';
  else step = 'gate';

  /* ── d'où l'on revient ──────────────────────────────────────────────────── */
  const makeHref = make ? `/?make=${encodeURIComponent(make.make)}` : '/';
  const modelHref = model ? `${makeHref}&model=${encodeURIComponent(model.key)}` : makeHref;
  const carHref = needsGeneration ? modelHref : makeHref;

  const backHref: string | null =
    step === 'make' || step === 'thanks' ? null
      : step === 'model' ? '/'
      : step === 'generation' ? makeHref
      : step === 'missing' ? (make ? makeHref : '/')
      : carHref;                          // gate et résultats reviennent au choix du char

  const car = carName(make?.make ?? null, model, gen);

  /* Le fond contextuel n'a de sens qu'entre le choix de la marque et les résultats :
     après, la photo produit prend le relais. */
  const context = make && (step === 'model' || step === 'generation' || step === 'gate')
    ? make.image
    : null;

  return (
    <>
      <Header backHref={backHref} />
      <Progress step={step} />

      <main>
        <ContextImage src={context} />

        {/* Le changement d'écran n'est plus un rechargement de page : sans cette
            annonce, un lecteur d'écran ne saurait pas que l'étape a changé. */}
        <p className="srOnly" role="status" aria-live="polite">
          {STEP_LABEL[step]}
          {car ? ` — ${car}` : ''}
        </p>

        {step === 'make' ? <StepMake /> : null}

        {step === 'model' && make ? (
          <StepModel
            make={make.make}
            models={make.models.map<ModelChoice>((m) => ({
              key: m.key,
              label: m.label,
              years: m.years ? `${m.years[0]}–${m.years[1]}` : '',
              search: m.fits.join(' ').toLowerCase()
            }))}
            parts={make.models.reduce((n, m) => n + m.products.length, 0)}
          />
        ) : null}

        {step === 'generation' && make && model ? (
          <StepGeneration
            make={make.make}
            model={model}
            generations={model.generations}
            parts={model.products.length}
          />
        ) : null}

        {step === 'gate' ? (
          <>
            {/* Le char est choisi : c'est le moment où Meta doit compter un lead. */}
            {car ? <Track event="Lead" data={{ content_name: car, content_type: 'vehicle_selected' }} /> : null}
            <StepGate
              carName={car || 'car'}
              partCount={parts.length}
              resultsHref={`${gen ? `${modelHref}&year=${gen.from}` : modelHref}&step=results`}
              parts={parts.map((p) => ({ title: p.title, price: p.price }))}
              /* Sans ces trois-là, l'opportunité arrivait dans GHL sans marque : pas de
                 tag de marque sur le contact, et une note qui disait « Marque : — ». */
              make={make?.make ?? null}
              model={model?.label ?? null}
              generation={gen ? generationLabel(gen) : null}
            />
          </>
        ) : null}

        {step === 'results' ? (
          <>
            {/* Le filet sous la garantie du gate : rejoue un lead que /api/lead
                n'aurait pas réussi à écrire à l'étape précédente. */}
            <LeadRetry />
            <StepResults carName={car} parts={parts} shop={SHOP} />
          </>
        ) : null}

        {step === 'missing' ? (
          <StepMissing
            make={make?.make ?? null}
            model={model ? model.label : null}
          />
        ) : null}

        {step === 'thanks' ? <StepThanks car={qs.car ?? null} /> : null}
      </main>
    </>
  );
}
