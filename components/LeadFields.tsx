'use client';

/* Les champs partagés par les deux formulaires du parcours (le gate et « mon char
 * n'est pas listé »), pour que la validation, les messages et l'accessibilité ne
 * puissent pas diverger entre les deux.
 *
 * Accessibilité : chaque message d'erreur porte un id lié à son champ par
 * aria-describedby, et le champ passe en aria-invalid. La page statique se contentait
 * d'une classe CSS rouge — visible pour qui regarde l'écran, invisible pour le reste.
 */

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
