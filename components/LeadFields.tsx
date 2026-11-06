'use client';

/* Les champs partagés par les deux formulaires du parcours (le gate et « mon char
 * n'est pas listé »), pour que la validation, les messages et l'accessibilité ne
 * puissent pas diverger entre les deux.
 *
 * Accessibilité : chaque message d'erreur porte un id lié à son champ par
 * aria-describedby, et le champ passe en aria-invalid. La page statique se contentait
 * d'une classe CSS rouge — visible pour qui regarde l'écran, invisible pour le reste.
 */

import { SMS_CONSENT_TEXT, SMS_CONSENT_LINKS } from '@/lib/consent';

/* Le texte reste UNE chaîne (c'est elle qui part dans la note GHL comme preuve) ; seuls
   les mots « Privacy Policy » et « Terms of Service » deviennent des liens à l'affichage. Ils
   s'ouvrent dans un nouvel onglet pour ne pas perdre le formulaire en cours. */
function withLinks(text: string) {
  const parts: React.ReactNode[] = [];
  let rest = text;
  for (const { label, href } of SMS_CONSENT_LINKS) {
    const i = rest.indexOf(label);
    if (i < 0) continue;
    parts.push(rest.slice(0, i));
    parts.push(<a key={href} href={href} target="_blank" rel="noopener">{label}</a>);
    rest = rest.slice(i + label.length);
  }
  parts.push(rest);
  return parts;
}

export type FieldState = { value: string; bad: boolean };

export function Field({
  id,
  label,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  state,
  onChange
}: {
  id: string;
  label: string;
  error: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'email' | 'tel' | 'text';
  placeholder: string;
  state: FieldState;
  onChange: (v: string) => void;
}) {
  return (
    <div className={`field${state.bad ? ' is-bad' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        value={state.value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={state.bad}
        aria-describedby={state.bad ? `${id}-err` : undefined}
        required
      />
      <p className="err" id={`${id}-err`}>
        {error}
      </p>
    </div>
  );
}

/* La case de consentement aux textos. Jamais pré-cochée, jamais obligatoire : voir
   lib/consent.ts. Le libellé affiché EST le texte recopié dans la note GHL. */
export function SmsConsent({
  id,
  checked,
  onChange
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="consent">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>{withLinks(SMS_CONSENT_TEXT)}</label>
    </div>
  );
}

/* Champ piège à robots : hors flux, hors tabulation, hors lecteur d'écran. Un
   remplisseur automatique le voit dans le DOM et le remplit ; personne d'autre. */
export function Honeypot({
  id,
  value,
  onChange
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="hp" aria-hidden="true">
      <label htmlFor={id}>Company</label>
      <input
        id={id}
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
