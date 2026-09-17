import { SHOP } from '@/lib/catalog';

export default function StepThanks({ car }: { car: string | null }) {
  return (
    <section className="screen wrap wrap--narrow" aria-labelledby="step-title">
      <p className="rule">
        <b>✓</b> Received
      </p>
      <h1 id="step-title">
        We have
        <br />
        your car.
      </h1>
      <p className="sub">
        {car
          ? `A builder comes back to you about the ${car} — whether we can build it, and what it runs.`
          : "A builder comes back to you with what fits and what it costs. If you'd rather not wait, the shop is open."}
      </p>
      <p style={{ marginTop: 28 }}>
        <a className="btn" href={SHOP}>
          Browse the shop
        </a>
      </p>
    </section>
  );
}
