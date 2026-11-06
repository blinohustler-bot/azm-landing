'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CONFIG } from '@/lib/config';
import { money } from '@/lib/catalogTypes';
import { track } from '@/lib/track';
import { withCheckout } from '@/lib/checkout';
import { isChatLinkUrl, isShopUrl } from '@/lib/shopHost';

/* Le chat Tyler sur l'écran des pièces.
 *
 * Chargé après la page (TylerChatMount, next/dynamic ssr:false) : rien de ce fichier
 * n'est dans le premier rendu ni dans le LCP. Il ne se montre qu'à un visiteur qui a
 * laissé ses coordonnées (cookie azm_chat, vérifié côté serveur par /api/chat/status).
 *
 * Le navigateur n'envoie que make / model / year — les mêmes valeurs que l'URL de la
 * page — et le texte tapé. L'écran (pièces, prix) est reconstruit par le serveur : un
 * prix affiché ici vient TOUJOURS d'un évènement `proposal` de Tyler, jamais d'ailleurs.
 *
 * 64 % des visiteurs sont dans le navigateur intégré d'Instagram : pas de window.open,
 * pas de popup, pas de cookie tiers. CHECKOUT est un lien du même onglet, comme
 * « Buy now » sur les cartes.
 *
 * L'historique reste dans la mémoire du composant : rien n'est écrit en local, sauf le
 * drapeau « la bulle a déjà été montrée » en sessionStorage.
 */

type Item = { title: string; option: string; priceCAD: number };
type Slot = { label: string; startIso: string };

type Line =
  | { id: number; kind: 'tyler'; text: string }
  | { id: number; kind: 'me'; text: string }
  | { id: number; kind: 'proposal'; url: string; items: Item[]; totalCAD: number; called: boolean }
  | { id: number; kind: 'slots'; slots: Slot[]; used: boolean }
  | { id: number; kind: 'fallback' }
  /* Tyler ne répond pas sur ce fil (Tommy l'a, ou le chat est arrêté) : le message du
     visiteur est gardé côté Tyler et Tommy est prévenu. */
  | { id: number; kind: 'tommy' };

/* Une ligne sans son id (Omit distribué sur chaque membre de l'union). */
type NewLine = Line extends infer L ? (L extends Line ? Omit<L, 'id'> : never) : never;

type Props = {
  firstName?: string;
  /* Le nom affiché du modèle (« M3 ») : il sert à la copie de la bulle. */
  model: string;
  make: string;
  /* La clé du modèle dans l'URL (« m3 ») : c'est elle qui part au serveur. */
  modelKey: string;
  year?: string;
  /* L'adresse du magasin (catalogue) : seule destination permise pour CHECKOUT. */
  shop: string;
};

const BUBBLE_DELAY_MS = 15_000;
const BUBBLE_SCROLL_PX = 200;
const BUBBLE_KEY = 'azm_tchat_bubble';
/* Un tour dure 25 à 45 s, en plusieurs bulles : on ne juge pas la durée totale, on juge
   le silence. 25 s sans le moindre évènement = Tyler est injoignable. */
const SILENCE_MS = 25_000;
const PRESENCE_MS = 30_000;
const MAX_TEXT = 1000;

const CALL_TEXT = "I'd rather talk to Tommy";

type Clarity = (...args: unknown[]) => void;
function clarity(value: 'bubble_shown' | 'open' | 'msg' | 'checkout' | 'call') {
  try {
    const c = (window as unknown as { clarity?: Clarity }).clarity;
    if (typeof c === 'function') c('set', 'chat', value);
  } catch {
    /* jamais bloquant */
  }
}

/* Le prénom de la bulle : le premier mot, 14 caractères au plus (un prénom composé ou
   un nom complet tapé dans le formulaire ne fait pas déborder la bulle). */
function bubbleName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const first = raw.trim().split(/\s+/)[0] ?? '';
  return first ? first.slice(0, 14) : undefined;
}

/* Le texte de Tyler est rendu en texte brut (aucun HTML injecté). Seule une adresse
   https de la liste des liens de texte (le magasin, les vidéos YouTube / Instagram, la
   prise de rendez-vous GoRendezvous : lib/shopHost.ts isChatLinkUrl, PAS la liste de
   CHECKOUT) devient un lien, construit comme élément React ; la ponctuation qui la suit
   reste du texte. Toute autre adresse, http comprise, reste du texte. */
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
function linkify(text: string, shop: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) => {
    if (i % 2 === 0) return part;
    const m = part.match(/^(.*?)([.,!?;:)\]]*)$/);
    const url = m ? m[1] : part;
    const tail = m ? m[2] : '';
    if (!isChatLinkUrl(url, shop)) return part;
    return (
      <span key={i}>
        <a href={url} rel="noopener noreferrer">{url}</a>
        {tail}
      </span>
    );
  });
}

function readItems(raw: unknown): Item[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: Item[] = [];
  for (const it of raw) {
    const o = it as Record<string, unknown>;
    if (typeof o?.title !== 'string' || typeof o.priceCAD !== 'number' || !Number.isFinite(o.priceCAD)) return null;
    out.push({ title: o.title, option: typeof o.option === 'string' ? o.option : '', priceCAD: o.priceCAD });
  }
  return out;
}

function readSlots(raw: unknown): Slot[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = raw
    .map((s) => s as Record<string, unknown>)
    .filter((s) => typeof s?.label === 'string' && s.label)
    .map((s) => ({ label: String(s.label), startIso: typeof s.startIso === 'string' ? s.startIso : '' }));
  return out.length ? out : null;
}

export default function TylerChat({ firstName: firstNameProp, model, make, modelKey, year, shop }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [firstName, setFirstName] = useState(bubbleName(firstNameProp));
  const [bubble, setBubble] = useState(false);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [yieldDock, setYieldDock] = useState(false);
  /* Après un repli, l'en-tête dit « Offline » jusqu'au prochain évènement réussi. */
  const [offline, setOffline] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const busy = useRef(false);
  const queue = useRef<string[]>([]);
  const started = useRef(false);
  const touched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const wasOpen = useRef(false);
  const yieldRef = useRef(false);
  /* Tyler ne répond pas sur ce fil (statut stopped / handoff) : pas d'indicateur
     « typing… » qui ferait croire qu'il écrit, et la ligne « Tommy will get back to you »
     une seule fois, jusqu'à ce que Tyler réponde de nouveau. */
  const stopped = useRef(false);
  const tommyShown = useRef(false);

  const add = useCallback((l: NewLine) => {
    const id = nextId.current++;
    setLines((prev) => [...prev, { ...l, id } as Line]);
  }, []);

  /* ── statut : le chat est-il offert à ce visiteur ? ─────────────────────── */
  useEffect(() => {
    let alive = true;
    fetch('/api/chat/status', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled?: boolean; firstName?: string } | null) => {
        if (!alive || !d?.enabled) return;
        const name = bubbleName(d.firstName);
        if (name) setFirstName(name);
        setEnabled(true);
      })
      .catch(() => { /* 401, réseau : pas de chat, sans bruit */ });
    return () => { alive = false; };
  }, []);

  /* ── présence : toutes les 30 s tant que l'onglet est visible ───────────── */
  useEffect(() => {
    if (!enabled) return;
    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/chat/presence', { method: 'POST', credentials: 'same-origin', keepalive: true })
        .catch(() => { /* au mieux */ });
    };
    ping();
    const t = setInterval(ping, PRESENCE_MS);
    const onVis = () => { if (document.visibilityState === 'visible') ping(); };
    const onHide = () => {
      try { navigator.sendBeacon?.('/api/chat/presence'); } catch { /* au mieux */ }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, [enabled]);

  /* ── la bulle : 15 s sans interaction, une fois par session ─────────────── */
  useEffect(() => {
    if (!enabled) return;
    try { if (sessionStorage.getItem(BUBBLE_KEY)) return; } catch { /* stockage bloqué : on tente */ }
    const y0 = window.scrollY;
    const cancel = () => { touched.current = true; cleanup(); };
    const onScroll = () => { if (Math.abs(window.scrollY - y0) > BUBBLE_SCROLL_PX) cancel(); };
    let t: ReturnType<typeof setTimeout>;
    /* Si un « Buy now » est sous le bouton flottant à ce moment-là, la bulle attend
       qu'il soit passé plutôt que d'apparaître effacée. */
    const show = () => {
      if (touched.current || started.current) return cleanup();
      if (yieldRef.current) { t = setTimeout(show, 1000); return; }
      cleanup();
      try { sessionStorage.setItem(BUBBLE_KEY, '1'); } catch { /* au mieux */ }
      setBubble(true);
      clarity('bubble_shown');
    };
    t = setTimeout(show, BUBBLE_DELAY_MS);
    function cleanup() {
      clearTimeout(t);
      window.removeEventListener('pointerdown', cancel, true);
      window.removeEventListener('keydown', cancel, true);
      window.removeEventListener('scroll', onScroll);
    }
    window.addEventListener('pointerdown', cancel, true);
    window.addEventListener('keydown', cancel, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return cleanup;
  }, [enabled]);

  /* ── placement : au-dessus de la barre de commande, jamais sur un « Buy now » ──
     La barre .bundle colle en bas de l'écran quand des pièces sont cochées : le bouton
     et la bulle montent au-dessus d'elle. Un « Buy now » qui passe sous le bouton
     flottant pendant le défilement le fait s'effacer le temps du passage : le bouton
     qui vend n'est jamais couvert. */
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const GAP = 16;
    const measure = () => {
      raf = 0;
      const root = rootRef.current;
      const dock = dockRef.current;
      if (!root || !dock) return;
      const vh = window.innerHeight;
      let lift = GAP;
      const bundle = document.querySelector('.bundle');
      if (bundle) {
        const r = bundle.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) lift = Math.max(GAP, vh - r.top + 12);
      }
      root.style.setProperty('--tchat-lift', `${Math.round(lift)}px`);
      const d = dock.getBoundingClientRect();
      const bottom = vh - lift;
      const top = bottom - d.height;
      let hit = false;
      document.querySelectorAll('.card__actions .btn').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.bottom > top && r.top < bottom && r.right > d.left && r.left < d.right) hit = true;
      });
      yieldRef.current = hit;
      setYieldDock(hit);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const mo = new MutationObserver(schedule);
    const main = document.querySelector('main');
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      mo.disconnect();
    };
  }, [enabled, bubble, open]);

  /* ── un tour de conversation ──────────────────────────────────────────────
     Jamais deux tours en même temps : un message tapé pendant un tour attend son
     `done`, puis part (les messages en attente partent ensemble, dans un seul tour). */
  const runTurn = useCallback(async (text: string | null) => {
    busy.current = true;
    /* Le visiteur a écrit : « typing… » tout de suite, sans attendre le premier évènement
       de Tyler (le modèle prend quelques secondes avant de répondre). */
    if (text !== null && !stopped.current) setTyping(true);
    const ctl = new AbortController();
    abortRef.current = ctl;
    let silence: ReturnType<typeof setTimeout> | null = null;
    let failed = false;
    let sawDone = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      setTyping(false);
      setOffline(true);
      add({ kind: 'fallback' });
    };
    const arm = () => {
      if (silence) clearTimeout(silence);
      silence = setTimeout(() => { fail(); ctl.abort(); }, SILENCE_MS);
    };

    const handle = (ev: Record<string, unknown>) => {
      if (ev.type === 'typing' || ev.type === 'message' || ev.type === 'proposal' || ev.type === 'slots') {
        setOffline(false);
        stopped.current = false;
        tommyShown.current = false;
      }
      switch (ev.type) {
        case 'status':
          /* Un humain a le fil, ou le chat est arrêté : Tyler ne répondra pas. Le message
             tapé est gardé chez Tyler et Tommy est prévenu ; une ouverture seule n'a rien
             transmis, elle reçoit le repli avec le numéro. Les autres statuts (booked…)
             ne changent rien ici. */
          if (ev.status !== 'stopped' && ev.status !== 'handoff') break;
          stopped.current = true;
          setTyping(false);
          setOffline(true);
          if (text === null) add({ kind: 'fallback' });
          else if (!tommyShown.current) {
            tommyShown.current = true;
            add({ kind: 'tommy' });
          }
          break;
        case 'typing':
          setTyping(true);
          break;
        case 'message':
          setTyping(false);
          if (typeof ev.text === 'string' && ev.text.trim()) add({ kind: 'tyler', text: ev.text });
          break;
        case 'proposal': {
          setTyping(false);
          const url = isShopUrl(ev.url, shop) ? ev.url : null;
          const items = readItems(ev.items);
          const total = typeof ev.totalCAD === 'number' && Number.isFinite(ev.totalCAD) ? ev.totalCAD : null;
          if (url && items && total !== null) add({ kind: 'proposal', url, items, totalCAD: total, called: false });
          break;
        }
        case 'slots': {
          setTyping(false);
          const slots = readSlots(ev.slots);
          if (slots) add({ kind: 'slots', slots, used: false });
          break;
        }
        case 'error':
          fail();
          break;
        case 'done':
          sawDone = true;
          break;
        default:
          /* tool, score, profile, action, thinking… : pas pour le visiteur */
          break;
      }
    };

    try {
      arm();
      const res = await fetch('/api/chat/turn', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, make, model: modelKey, ...(year ? { year } : {}) }),
        signal: ctl.signal
      });
      if (!res.ok || !res.body) throw new Error(`turn ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (!sawDone) {
        const { done, value } = await reader.read();
        if (done) break;
        arm();
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        for (const l of parts) {
          if (!l.startsWith('data:')) continue;
          try { handle(JSON.parse(l.slice(5).trim())); } catch { /* ligne illisible : ignorée */ }
          if (sawDone) break;
        }
      }
      if (sawDone) reader.cancel().catch(() => {});
      /* Le relais garantit error + done ; un flux coupé sans `done` est une panne. */
      if (!sawDone) fail();
    } catch {
      fail();
    } finally {
      if (silence) clearTimeout(silence);
      setTyping(false);
      abortRef.current = null;
      busy.current = false;
    }

    /* Les messages tapés pendant le tour partent maintenant, ensemble. */
    if (queue.current.length) {
      let next = queue.current.shift() as string;
      while (queue.current.length && next.length + 1 + queue.current[0].length <= MAX_TEXT) {
        next += '\n' + (queue.current.shift() as string);
      }
      void runTurn(next);
    }
  }, [add, make, modelKey, year, shop]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback((raw: string) => {
    const text = raw.trim().slice(0, MAX_TEXT);
    if (!text) return;
    add({ kind: 'me', text });
    clarity('msg');
    if (!stopped.current) setTyping(true);
    if (busy.current) queue.current.push(text);
    else void runTurn(text);
  }, [add, runTurn]);

  /* ── ouvrir, fermer ─────────────────────────────────────────────────────── */
  const openChat = useCallback(() => {
    setBubble(false);
    setOpen(true);
    clarity('open');
    if (!started.current) {
      started.current = true;
      void runTurn(null);
    }
  }, [runTurn]);

  const closeChat = useCallback(() => setOpen(false), []);

  /* Le focus va au champ à l'ouverture, revient au bouton à la fermeture. */
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) fabRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeChat(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeChat]);

  /* La page ne défile pas sous la feuille ouverte (verrou rendu à la fermeture). */
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const saved = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = saved[0];
      body.style.overflow = saved[1];
    };
  }, [open]);

  /* Le clavier du téléphone : la feuille se pose sur la partie visible de l'écran
     (visualViewport), pour que le champ et le dernier message restent au-dessus du
     clavier, y compris dans le navigateur intégré d'Instagram. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const fit = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      panel.style.setProperty('--tchat-kb', `${Math.round(kb)}px`);
      panel.style.setProperty('--tchat-vh', `${Math.round(vv.height)}px`);
      const log = logRef.current;
      if (log) log.scrollTop = log.scrollHeight;
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
    };
  }, [open]);

  /* Le fil descend tout seul à chaque nouvelle bulle. */
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, typing, open]);

  /* La bulle tient en deux lignes (≤ 90 px, sous le titre de la carte). La copie validée
     ne passe qu'avec un prénom court (« Alex ») : au-delà, on la raccourcit d'un cran
     (« … with parts for your M3? »), puis sans le prénom. Mesuré au rendu : la largeur
     d'un prénom ou d'un modèle ne se devine pas au nombre de caractères. */
  const greetRef = useRef<HTMLParagraphElement>(null);
  const [greetLevel, setGreetLevel] = useState(0);
  useEffect(() => { setGreetLevel(0); }, [firstName, model]);
  useLayoutEffect(() => {
    const p = greetRef.current;
    if (!bubble || !p) return;
    const lh = parseFloat(getComputedStyle(p).lineHeight) || 16;
    if (p.offsetHeight > lh * 2 + 1 && greetLevel < (firstName ? 2 : 1)) setGreetLevel(greetLevel + 1);
  }, [bubble, firstName, model, greetLevel]);

  if (!enabled) return null;

  const name = greetLevel < 2 ? firstName : undefined;
  const ask = greetLevel === 0 ? `need a hand picking the right parts for your ${model}?` : `need a hand with parts for your ${model}?`;
  const greeting = name ? `Hey ${name}, ${ask}` : `Hey, ${ask}`;

  /* Rendu dans <body> : la section des résultats garde un `translate` de son animation
     d'entrée, ce qui ferait de `position:fixed` une position relative à la section (le
     bouton se retrouvait à 3 400 px de haut, hors de l'écran). */
  return createPortal(
    <div ref={rootRef} className="tchat">
      {!open ? (
        <div ref={dockRef} className={`tchat__dock${yieldDock ? ' is-yield' : ''}`}>
          {bubble ? (
            <div className="tchat__bubble" role="status">
              <button
                type="button"
                className="tchat__x"
                aria-label="Dismiss"
                onClick={() => setBubble(false)}
              >
                ✕
              </button>
              <p ref={greetRef}>{greeting}</p>
              <div className="tchat__choices">
                <button type="button" className="tchat__yes" onClick={openChat}>Yeah, help me</button>
                <button type="button" className="tchat__no" onClick={() => setBubble(false)}>I'm good</button>
              </div>
            </div>
          ) : null}
          <button
            ref={fabRef}
            type="button"
            className="tchat__fab"
            aria-haspopup="dialog"
            onClick={openChat}
          >
            💬 Ask Tyler
          </button>
        </div>
      ) : null}

      {/* Sur téléphone, la page derrière la feuille s'assombrit : sans ça, l'en-tête noir
          de la feuille se fondait dans la page noire. Toucher le fond ferme le chat. */}
      {open ? <div className="tchat__scrim" aria-hidden="true" onClick={closeChat} /> : null}

      {open ? (
        <div ref={panelRef} className="tchat__panel" role="dialog" aria-label="Chat with Tyler">
          <div className="tchat__head">
            <div>
              <b>Tyler · AZ Motorsport</b>
              <span className={`tchat__online${offline ? ' is-off' : ''}`}><i aria-hidden="true" />{offline ? 'Offline' : 'Online'}</span>
            </div>
            <button type="button" className="tchat__close" aria-label="Close chat" onClick={closeChat}>
              ✕
            </button>
          </div>

          <div ref={logRef} className="tchat__log" aria-live="polite">
            {lines.map((l) => {
              if (l.kind === 'tyler') return <p key={l.id} className="tchat__msg">{linkify(l.text, shop)}</p>;
              if (l.kind === 'me') return <p key={l.id} className="tchat__msg tchat__msg--me">{l.text}</p>;
              if (l.kind === 'fallback') {
                return (
                  <p key={l.id} className="tchat__msg tchat__msg--fail">
                    Can't reach Tyler right now, call us at{' '}
                    <a href={CONFIG.PHONE_HREF} onClick={() => clarity('call')}>{CONFIG.PHONE}</a>.
                  </p>
                );
              }
              if (l.kind === 'tommy') {
                return (
                  <p key={l.id} className="tchat__msg tchat__msg--note">
                    Tommy will get back to you shortly. You can also call{' '}
                    <a href={CONFIG.PHONE_HREF} onClick={() => clarity('call')}>{CONFIG.PHONE}</a>.
                  </p>
                );
              }
              if (l.kind === 'slots') {
                return (
                  <div key={l.id} className="tchat__slots">
                    {l.slots.map((s) => (
                      <button
                        key={s.label + s.startIso}
                        type="button"
                        disabled={l.used}
                        onClick={() => {
                          setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, used: true } : x)));
                          send(s.label);
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                );
              }
              return (
                <div key={l.id} className="tchat__card">
                  <ul>
                    {l.items.map((it, i) => (
                      <li key={i}>
                        <span>
                          <b>{it.title}</b>
                          {it.option ? <> {it.option}</> : null}
                        </span>
                        {l.items.length > 1 ? <em>{money(it.priceCAD)}</em> : null}
                      </li>
                    ))}
                  </ul>
                  <p className="tchat__price">
                    <b>{money(l.totalCAD)}</b>
                    {l.totalCAD >= CONFIG.FREE_SHIP_MIN ? <span>ships free</span> : null}
                  </p>
                  <a
                    className="btn btn--wide"
                    href={l.url}
                    onClick={(e) => {
                      e.currentTarget.href = withCheckout(l.url);
                      track('AddToCart', { value: l.totalCAD, currency: 'CAD', content_name: 'tyler-chat' });
                      clarity('checkout');
                    }}
                  >
                    CHECKOUT
                  </a>
                  <button
                    type="button"
                    className="tchat__call"
                    disabled={l.called}
                    onClick={() => {
                      setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, called: true } : x)));
                      clarity('call');
                      send(CALL_TEXT);
                    }}
                  >
                    Want to talk it through with Tommy first? Grab a quick call
                  </button>
                </div>
              );
            })}
            {typing ? <p className="tchat__typing">typing…</p> : null}
          </div>

          <form
            className="tchat__form"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
              setDraft('');
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={MAX_TEXT}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => {
                /* Le clavier s'ouvre : le dernier message et le champ restent visibles. */
                setTimeout(() => {
                  const log = logRef.current;
                  if (log) log.scrollTop = log.scrollHeight;
                  inputRef.current?.scrollIntoView({ block: 'nearest' });
                }, 300);
              }}
              placeholder="Ask about fitment, sound, shipping"
              aria-label="Message Tyler"
              autoComplete="off"
              enterKeyHint="send"
            />
            <button type="submit" disabled={!draft.trim()}>Send</button>
          </form>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
