'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Honeypot, type FieldState } from './LeadFields';
import { sendLead, okEmail, okPhone, okName } from '@/lib/sendLead';
import { track } from '@/lib/track';

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
  parts
}: {
  carName: string;
  partCount: number;
  resultsHref: string;
  parts: { title: string; price: number }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(blank);
  const [email, setEmail] = useState(blank);
  const [phone, setPhone] = useState(blank);
  const [company, setCompany] = useState('');
  const shownAt = useRef(Date.now());
  const [sending, setSending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const nOk = okName(name.value);
    const eOk = okEmail(email.value);
    const pOk = okPhone(phone.value);
    setName((s) => ({ ...s, bad: !nOk }));
    setEmail((s) => ({ ...s, bad: !eOk }));
    setPhone((s) => ({ ...s, bad: !pOk }));
    if (!nOk || !eOk || !pOk) return;

    setSending(true);
    sendLead({
      source: 'fitment_lp',
      name: name.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      car: carName,
      parts,
      page: window.location.href,
      elapsedMs: Date.now() - shownAt.current,
      company
    });
    track('CompleteRegistration', { content_name: carName, status: 'fitment_lead' });

    /* On ne se met pas en travers : la requête est partie, les pièces s'affichent. */
    router.push(resultsHref, { scroll: false });
  }

  const sub = partCount
    ? `We found ${partCount} ${partCount === 1 ? 'part' : 'parts'} built for your ${carName}. Tell us where to send the fitment sheet and they show up right now.`
    : `Tell us where to reach you and we'll confirm what we can build for your ${carName}.`;

  return (
    <section className="screen wrap wrap--narrow" aria-labelledby="step-title">
      <p className="rule">
        <b>04</b> Where to send it
      </p>
      <h1 id="step-title">
        Your fitment
        <br />
        sheet.
      </h1>
      <p className="sub">{sub}</p>

      <div className="vehicle-chip">
        Your car <b>{carName}</b>
      </div>

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
          {sending ? 'Loading your parts…' : 'Show my parts →'}
        </button>
        <p className="legal">
          No spam. We use this to confirm the fitment on your chassis and to answer install
          questions. One message, from a human.
        </p>
      </form>
    </section>
  );
}
