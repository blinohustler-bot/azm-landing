'use client';

/* La monnaie choisie et les prix Shopify qui vont avec, partagés par tous les composants
 * de la page sans fournisseur React : un petit magasin externe + useSyncExternalStore.
 * Le sélecteur de l'en-tête et les cartes de l'écran des pièces vivent dans des arbres
 * différents (l'en-tête est rendu par le serveur), un contexte ne les relierait pas.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { BASE, CUR_COOKIE, byCode, currencyForCountry, fmt } from './currency';
import { money } from './catalogTypes';

type State = { cur: string; prices: Record<string, number> };

let state: State = { cur: BASE, prices: {} };
let ready = false;
const listeners = new Set<() => void>();
const pending = new Set<string>();

function emit() { listeners.forEach((l) => l()); }

function init() {
  if (ready || typeof document === 'undefined') return;
  ready = true;
  const saved = document.cookie.match(new RegExp(`(?:^|; )${CUR_COOKIE}=([A-Z]{3})`))?.[1];
  const geo = document.body?.dataset.geo || '';
  state = { ...state, cur: byCode(saved)?.code ?? currencyForCountry(geo) };
}

function subscribe(l: () => void) {
  init();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/* Le rendu serveur ne connaît pas le cookie : il sort toujours en CAD, et le client
   bascule après l'hydratation. Pas d'écart d'hydratation, au prix d'un clignement d'un
   instant pour un visiteur non canadien. */
const serverSnap: State = { cur: BASE, prices: {} };

export function setCurrency(code: string) {
  const c = byCode(code);
  if (!c) return;
  document.cookie = `${CUR_COOKIE}=${c.code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax; secure`;
  state = { ...state, cur: c.code };
  emit();
}

export function useCurrency(): string {
  return useSyncExternalStore(subscribe, () => { init(); return state; }, () => serverSnap).cur;
}

/* Le pays à passer au checkout pour qu'il s'ouvre dans la monnaie choisie, CAD compris :
   un Américain qui choisit CAD doit payer en CAD. Lu au clic (withCheckout), hors React. */
export function checkoutCountry(): string | null {
  init();
  return byCode(state.cur)?.country ?? null;
}

const key = (cur: string, id: number) => `${cur}:${id}`;

async function load(cur: string, ids: number[]) {
  const missing = ids.filter((id) => !(key(cur, id) in state.prices) && !pending.has(key(cur, id)));
  if (!missing.length) return;
  missing.forEach((id) => pending.add(key(cur, id)));
  try {
    const r = await fetch(`/api/prices?cur=${cur}&ids=${missing.join(',')}`);
    if (!r.ok) return;
    const j = (await r.json()) as { prices: Record<string, number> };
    const next = { ...state.prices };
    for (const [id, p] of Object.entries(j.prices)) next[key(cur, Number(id))] = p;
    state = { ...state, prices: next };
    emit();
  } catch { /* réseau : les cartes restent en CAD */ } finally {
    missing.forEach((id) => pending.delete(key(cur, id)));
  }
}

/* Les prix locaux de ces variantes. `price(id)` vaut null tant que Shopify n'a pas
   répondu (ou en CAD) : l'appelant affiche alors le prix CAD. */
export function useLocalPrices(ids: number[]) {
  const snap = useSyncExternalStore(subscribe, () => { init(); return state; }, () => serverSnap);
  const cur = snap.cur;
  const sig = ids.join(',');
  useEffect(() => {
    if (cur !== BASE && sig) void load(cur, sig.split(',').map(Number));
  }, [cur, sig]);
  return {
    cur,
    price: (id: number): number | null =>
      cur === BASE ? null : snap.prices[key(cur, id)] ?? null
  };
}

/* Affiche un montant : en CAD avec le format historique de la page, sinon dans la
   monnaie choisie. `local` null = prix pas encore reçu → on garde le CAD. */
export function show(cad: number, local: number | null, cur: string): string {
  if (cur === BASE || local == null) return money(cad);
  return fmt(local, cur);
}

/* Le prix après le rabais Black Friday, comme Shopify le calcule : pourcentage du palier
   atteint EN CAD, appliqué au prix local, arrondi au cent (1 576,95 € × 0,85 = 1 340,41 €). */
export function afterPct(amount: number, pct: number, cur: string): number {
  const v = amount * (1 - pct / 100);
  return cur === BASE ? Math.round(v) : Math.round(v * 100) / 100;
}
