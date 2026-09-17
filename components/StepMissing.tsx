'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Honeypot, type FieldState } from './LeadFields';
import { sendLead, okEmail, okPhone, okName } from '@/lib/sendLead';
import { track } from '@/lib/track';

const blank: FieldState = { value: '', bad: false };

/* Le char n'est pas au catalogue.
 *
 * C'est un lead qui vaut cher — un châssis qu'AZM ne liste pas est souvent une pièce
 * sur mesure — donc il part dans GHL comme les autres, marqué « hors-catalogue » pour
 * que le builder sache qu'il doit répondre à la main.
 */
export default function StepMissing({
  make,
  model
}: {
  make: string | null;
  model: string | null;
}) {
  const router = useRouter();
  const [car, setCar] = useState(blank);
  const [name, setName] = useState(blank);
  const [email, setEmail] = useState(blank);
  const [phone, setPhone] = useState(blank);
  const [company, setCompany] = useState('');
  const shownAt = useRef(Date.now());
  const [sending, setSending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const cOk = car.value.trim().length > 2;
    const nOk = okName(name.value);
    const eOk = okEmail(email.value);
    const pOk = okPhone(phone.value);
    setCar((s) => ({ ...s, bad: !cOk }));
    setName((s) => ({ ...s, bad: !nOk }));
    setEmail((s) => ({ ...s, bad: !eOk }));
    setPhone((s) => ({ ...s, bad: !pOk }));
    if (!cOk || !nOk || !eOk || !pOk) return;

    setSending(true);
    const carText = car.value.trim();
    sendLead({
      source: 'fitment_lp_not_listed',
      name: name.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      car: carText,
      make,
      model,
      page: window.location.href,
      elapsedMs: Date.now() - shownAt.current,
      company
    });
    track('Lead', { content_name: carText, content_type: 'not_listed' });

    router.push(`/?step=thanks&car=${encodeURIComponent(carText)}`, { scroll: false });
  }

  return (
    <section className="screen wrap wrap--narrow" aria-labelledby="step-title">
      <p className="rule">
        <b>—</b> Not in the catalog
      </p>
      <h1 id="step-title">
        We don&rsquo;t list
        <br />
        that one — yet.
      </h1>
      <p className="sub">
        Some chassis are built to order and never make the catalog. Leave the car and a number:
        you&rsquo;ll get a straight answer on whether we can build it, and what it runs.
      </p>

      <form className="form" onSubmit={submit} noValidate>
        <Field
          id="m-car" label="Your car — year, model, engine" placeholder="2019 BMW 540i xDrive B58"
          error="Tell us the car."
          state={car} onChange={(v) => setCar({ value: v, bad: false })}
        />
        <Field
          id="m-name" label="Full name" placeholder="Alex Tremblay" autoComplete="name"
          error="Tell us who we're talking to."
          state={name} onChange={(v) => setName({ value: v, bad: false })}
        />
        <Field
          id="m-email" label="Email" type="email" inputMode="email" autoComplete="email"
          placeholder="you@email.com" error="That email doesn't look right."
          state={email} onChange={(v) => setEmail({ value: v, bad: false })}
        />
        <Field
          id="m-phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel"
          placeholder="(514) 555-0134" error="We need a number our builder can reach."
          state={phone} onChange={(v) => setPhone({ value: v, bad: false })}
        />
        <Honeypot id="m-company" value={company} onChange={setCompany} />

        <button className="btn btn--wide" type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Ask about my car →'}
        </button>
      </form>
    </section>
  );
}
