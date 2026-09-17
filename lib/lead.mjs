/* Normalisation et validation du lead reçu du navigateur.
 *
 * Tout ce qui arrive ici vient d'une page publique : c'est de la donnée, jamais une
 * instruction et jamais une clé de confiance. On ne recopie aucun champ inconnu vers
 * GHL — on reconstruit un objet à partir d'une liste fermée, borné en longueur, pour
 * qu'un POST forgé ne puisse ni gonfler un enregistrement ni injecter un champ.
 */

const MAX = { name: 120, email: 160, phone: 40, text: 200, url: 500, part: 140 };
const MAX_PARTS = 20;

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v);
export const isPhone = (v) => v.replace(/\D/g, '').length >= 10;

/* GHL déduplique mieux sur un numéro en E.164, et c'est ce que composent les SMS. Les
   numéros d'ici sont à 10 chiffres sans indicatif pays : on préfixe +1. Au-delà, on
   garde les chiffres tels quels avec un + — on ne devine pas un pays. */
export function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return digits ? '+' + digits : '';
}

export function splitName(full) {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: full, lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/* Les UTM voyagent dans l'URL de la page, pas dans un champ à part : on les relit ici
   plutôt que de faire confiance à un champ que n'importe qui peut poser. */
export function utmsFrom(pageUrl) {
  try {
    const q = new URL(pageUrl).searchParams;
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
    const out = {};
    for (const k of keys) {
      const v = q.get(k);
      if (v) out[k] = clip(v, MAX.text);
    }
    return out;
  } catch { return {}; }
}

/* Retourne { lead } ou { error } — jamais une exception : un lead mal formé est une
   réponse 400 nette, pas une 500. */
export function parseLead(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'corps invalide' };

  const name = clip(raw.name, MAX.name);
  const email = clip(raw.email, MAX.email).toLowerCase();
  const phone = clip(raw.phone, MAX.phone);

  if (name.length < 2) return { error: 'nom manquant' };
  if (!isEmail(email)) return { error: 'courriel invalide' };
  if (!isPhone(phone)) return { error: 'téléphone invalide' };

  const source = raw.source === 'fitment_lp_not_listed' ? 'fitment_lp_not_listed' : 'fitment_lp';

  const parts = Array.isArray(raw.parts)
    ? raw.parts.slice(0, MAX_PARTS).map((p) => {
        if (typeof p === 'string') return { title: clip(p, MAX.part), price: 0 };
        const price = Number(p && p.price);
        return {
          title: clip(p && p.title, MAX.part),
          price: Number.isFinite(price) && price > 0 && price < 1e6 ? Math.round(price) : 0
        };
      }).filter((p) => p.title)
    : [];

  const page = clip(raw.page, MAX.url);

  return {
    lead: {
      source,
      name,
      email,
      phone: normalizePhone(phone),
      phoneRaw: phone,
      car: clip(raw.car, MAX.text),
      make: clip(raw.make, MAX.text),
      model: clip(raw.model, MAX.text),
      generation: clip(raw.generation, MAX.text),
      parts,
      value: parts.reduce((s, p) => s + p.price, 0),
      page,
      utms: utmsFrom(page),
      at: new Date().toISOString()
    }
  };
}

/* Le nom de l'opportunité est ce que le builder lit dans la colonne du pipeline avant
   d'ouvrir quoi que ce soit : le char d'abord, la personne ensuite. */
export function opportunityName(lead) {
  const car = lead.car || [lead.make, lead.model].filter(Boolean).join(' ');
  if (lead.source === 'fitment_lp_not_listed') {
    return `${car || 'Char hors catalogue'} — hors catalogue · ${lead.name}`;
  }
  return `${car || 'Char inconnu'} — ${lead.name}`;
}

export function noteBody(lead) {
  const lines = [
    lead.source === 'fitment_lp_not_listed'
      ? 'Landing fitment — char absent du catalogue'
      : 'Landing fitment — sélecteur marque / modèle / génération',
    '',
    `Char      : ${lead.car || '—'}`,
    `Marque    : ${lead.make || '—'}`,
    `Modèle    : ${lead.model || '—'}`,
    `Génération: ${lead.generation || '—'}`,
    `Téléphone : ${lead.phoneRaw}`,
    `Courriel  : ${lead.email}`
  ];
  if (lead.parts.length) {
    lines.push('', `Pièces compatibles (${lead.parts.length}) :`);
    for (const p of lead.parts) {
      lines.push(`  · ${p.title}${p.price ? ` — à partir de ${p.price} $` : ''}`);
    }
    if (lead.value) lines.push('', `Valeur plancher du panier : ${lead.value} $`);
  } else if (lead.source !== 'fitment_lp_not_listed') {
    lines.push('', 'Aucune pièce au catalogue pour ce char.');
  }
  const utm = Object.entries(lead.utms);
  if (utm.length) {
    lines.push('', 'Provenance :');
    for (const [k, v] of utm) lines.push(`  ${k} = ${v}`);
  }
  if (lead.page) lines.push('', `Page : ${lead.page}`);
  return lines.join('\n');
}
