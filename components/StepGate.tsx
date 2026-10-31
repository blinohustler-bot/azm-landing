'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Honeypot, type FieldState } from './LeadFields';
import { sendLead, okEmail, okPhone, okName } from '@/lib/sendLead';
import { track } from '@/lib/track';
import { GATED_COOKIE } from '@/lib/config';

const blank: FieldState = { value: '', bad: false };

/* 04 — les coordonnées.
 *
 * Elles viennent après le choix du char, pas avant. Un formulaire placé avant la
 * première question a le plus haut taux d'abandon ; après trois clics, la réciprocité
 * joue. CONFIG.GATE_FIRST inverse l'ordre si on veut tester l'autre sens — le juge est
 * le coût par lead *servable*, pas le nombre de leads.
 */
export default function StepGate({
  carName,
  partCount,
  resultsHref,
  parts,
  make,
  model,
  generation,
  gateFirst = false
}: {
  carName: string;
  partCount: number;
  resultsHref: string;
  parts: { title: string; price: number }[];
  make: string | null;
  model: string | null;
  generation: string | null;
  /** Version B de l'A/B gate1 : le formulaire ouvre le parcours, sans char choisi. */
  gateFirst?: boolean;
}) {
  const noCar = !make;
  /* Formulaire en premier : même arrivé par une pub qui vise une marque, le char n'est
     pas encore choisi. Pas de puce « Your car », et le texte annonce la suite. */
  const before = noCar || (gateFirst && !partCount);
  const router = useRouter();
  const [name, setName] = useState(blank);
  const [email, setEmail] = useState(blank);
  const [phone, setPhone] = useState(blank);
  const [company, setCompany] = useState('');
  const shownAt = useRef(Date.now());
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;

    const nOk = okName(name.value);
    const eOk = okEmail(email.value);
    const pOk = okPhone(phone.value);
    setName((s) => ({ ...s, bad: !nOk }));
    setEmail((s) => ({ ...s, bad: !eOk }));
    setPhone((s) => ({ ...s, bad: !pOk }));
    if (!nOk || !eOk || !pOk) return;

    setSending(true);
    /* Le Lead de Meta, c'est ICI : des coordonnées valides, juste avant que l'opportunité
       naisse dans GHL et que les pièces s'affichent. Pas à l'affichage du formulaire —
       ça comptait comme lead toute personne qui l'avait seulement vu. */
    const value = parts.reduce((sum, p) => sum + (p.price || 0), 0);
    const label = noCar ? 'no car yet' : carName;
    track('Lead', { content_name: label, content_type: 'fitment_form', value, currency: 'CAD' });
    track('CompleteRegistration', { content_name: label, status: 'fitment_lead' });

    /* C'est ICI que l'opportunité doit naître : la personne a donné ses coordonnées,
       elle peut regarder les pièces et refermer l'onglet dans la minute. On attend donc
       la confirmation — mais jamais plus de cinq secondes (le délai vit dans sendLead).
       Si l'écriture n'a pas abouti, on passe quand même aux pièces : le lead est
       conservé et LeadRetry le rejoue sur l'écran suivant. */
    await sendLead({
      source: 'fitment_lp',
      name: name.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      car: noCar ? '' : carName,
      make,
      model,
      generation,
      parts,
      page: window.location.href,
      elapsedMs: Date.now() - shownAt.current,
      company
    });

    if (gateFirst) {
      try { document.cookie = `${GATED_COOKIE}=1; path=/; SameSite=Lax`; } catch { /* idem */ }
    }
    router.push(resultsHref, { scroll: false });
  }

  const sub = before
    ? 'Tell us where to send your fitment sheet. Then pick your car, and the parts built for it show up right away.'
    : partCount
    ? `We found ${partCount} ${partCount === 1 ? 'part' : 'parts'} built for your ${carName}. Tell us where to send the fitment sheet and they show up right now.`
    : `Tell us where to reach you and we'll confirm what we can build for your ${carName}.`;

  return (
    <section className="screen wrap wrap--narrow" aria-labelledby="step-title">
      <p className="rule">
        {gateFirst ? null : <b>04</b>} Where to send it
      </p>
      <h1 id="step-title">
        Your fitment
        <br />
        sheet.
      </h1>
      <p className="sub">{sub}</p>

      {before ? null : (
        <div className="vehicle-chip">
          Your car <b>{carName}</b>
        </div>
      )}

      <form className="form" onSubmit={submit} noValidate>
        <Field
          id="i-name" label="Full name" placeholder="Alex Tremblay" autoComplete="name"
          error="Tell us who we're talking to."
          state={name} onChange={(v) => setName({ value: v, bad: false })}
        />
        <Field
          id="i-email" label="Email" type="email" inputMode="email" autoComplete="email"
          placeholder="you@email.com" error="That email doesn't look right."
          state={email} onChange={(v) => setEmail({ value: v, bad: false })}
        />
        <Field
          id="i-phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel"
          placeholder="(514) 555-0134" error="We need a number our builder can reach."
          state={phone} onChange={(v) => setPhone({ value: v, bad: false })}
        />
        <Honeypot id="i-company" value={company} onChange={setCompany} />

        <button className="btn btn--wide" type="submit" disabled={sending}>
          {before
            ? (sending ? 'One second…' : 'Pick my car →')
            : (sending ? 'Loading your parts…' : 'Show my parts →')}
        </button>
        <p className="legal">
          No spam. We use this to confirm the fitment on your chassis and to answer install
          questions. One message, from a human.
        </p>
      </form>
    </section>
  );
}
