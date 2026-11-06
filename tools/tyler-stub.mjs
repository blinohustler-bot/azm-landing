/* Faux Tyler pour les essais locaux et les e2e — jamais en production.
 *
 *   node tools/tyler-stub.mjs            écoute sur :4010 (PORT pour changer)
 *   TYLER_URL=http://localhost:4010 TYLER_WEBCHAT_SECRET=stub TYLER_CHAT_FORCE=1 npm run dev
 *
 * Mêmes 3 routes que l'app Tyler (/api/webchat/status|presence|turn). `?fail=1` sur
 * n'importe laquelle répond 500. Le secret n'est pas vérifié : c'est un bouchon.
 * Le corps reçu par /turn est imprimé, pour voir l'écran reconstruit par la LP.
 *
 * Réponses de /turn :
 *   text null (ouverture)       typing, puis une question
 *   texte contenant « Tommy »   typing, un message, des créneaux (slots)
 *   tout autre texte            typing, un message, une proposition (proposal)
 *
 * Pilotage pour tools/e2e-chat.mjs (la LP appelle toujours la même adresse, donc le
 * mode se règle ici plutôt que dans l'URL) :
 *   GET /__mode?fail=1          /turn répond 500
 *   GET /__mode?delay=3000      attente avant le message (un tour « long »)
 *   GET /__mode?silent=1        /turn ouvre le flux et ne dit plus rien
 *   GET /__mode?ping=1          pendant l'attente, un commentaire « : ping » toutes les
 *                               10 s, comme Tyler (avec delay= : un tour long mais vivant)
 *   GET /__mode?blocked=1       /turn répond seulement { status: blocked } (la porte du
 *                               chat refuse : Tommy a le fil, Tyler est arrêté)
 *   GET /__mode?says=stopped    Tyler répond un message puis { status: stopped } (le
 *                               visiteur a demandé l'arrêt) ; says=handoff : un message
 *                               « Tommy va te contacter » puis { status: handoff }
 *   GET /__mode?name=…          le prénom renvoyé par /status (défaut Alex)
 *   GET /__mode                 retour au défaut
 *   GET /__log                  les tours reçus : { text, start, end }, en ms
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || 4010);

let mode = { fail: false, delay: 300, silent: false, ping: false, blocked: false, says: '', name: 'Alex' };
const turns = [];

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  if (u.pathname === '/__mode') {
    mode = {
      fail: u.searchParams.get('fail') === '1',
      delay: Number(u.searchParams.get('delay') || 300),
      silent: u.searchParams.get('silent') === '1',
      ping: u.searchParams.get('ping') === '1',
      blocked: u.searchParams.get('blocked') === '1',
      says: u.searchParams.get('says') || '',
      name: u.searchParams.get('name') || 'Alex'
    };
    turns.length = 0;
    return send(200, mode);
  }
  if (u.pathname === '/__log') return send(200, turns);
  if (u.searchParams.get('fail') === '1') return send(500, { error: 'stub failure' });

  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (u.pathname === '/api/webchat/status' && req.method === 'GET') {
      return send(200, { enabled: true, firstName: mode.name });
    }
    if (u.pathname === '/api/webchat/presence' && req.method === 'POST') {
      return send(200, { ok: true });
    }
    if (u.pathname === '/api/webchat/turn' && req.method === 'POST') {
      console.log('[tyler-stub] turn', body);
      let text = null;
      try { text = JSON.parse(body).text ?? null; } catch { /* corps illisible */ }
      const log = { text, start: Date.now(), end: null };
      turns.push(log);
      if (mode.fail) { log.end = Date.now(); return send(500, { error: 'stub failure' }); }

      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.flushHeaders();
      const ev = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
      const finish = () => { ev({ type: 'done' }); log.end = Date.now(); res.end(); };
      if (mode.blocked) {
        ev({ type: 'status', status: 'blocked' });
        return finish();
      }
      if (mode.says) {
        ev({ type: 'typing' });
        ev({ type: 'message', text: mode.says === 'stopped' ? "Got it — you won't hear from us again. Take care 🫡" : "I'm getting Tommy on it right now, he'll reach out to you personally." });
        ev({ type: 'status', status: mode.says });
        return finish();
      }
      ev({ type: 'typing' });
      if (mode.ping) {
        const beat = setInterval(() => res.write(': ping\n\n'), 10_000);
        res.on('close', () => clearInterval(beat));
      }
      if (mode.silent) {
        res.on('close', () => { log.end = Date.now(); });
        return;
      }
      setTimeout(() => {
        if (text === null) {
          ev({ type: 'message', text: "Quick check, it's a 2021 M3 you're working with?" });
        } else if (/tommy/i.test(text)) {
          ev({ type: 'message', text: 'Sure. Tommy has these open, pick one:' });
          ev({ type: 'slots', slots: [
            { label: 'Tomorrow 10:00', startIso: '2026-11-07T15:00:00Z' },
            { label: 'Tomorrow 14:30', startIso: '2026-11-07T19:30:00Z' }
          ] });
        } else {
          ev({ type: 'tool', name: 'pick' });
          ev({ type: 'message', text: 'For a street car I would run the catted downpipes. Details: https://azmotorsport.ca/products/bmw-m3-downpipes.' });
          ev({ type: 'proposal', url: 'https://azmotorsport.ca/cart/4321:1', items: [
            { title: 'BMW M3 / M4 G80 Downpipes', option: 'High Flow (catted)', priceCAD: 1149 }
          ], totalCAD: 1149 });
        }
        ev({ type: 'done' });
        log.end = Date.now();
        res.end();
      }, mode.delay);
      return;
    }
    send(404, { error: 'not found' });
  });
});

server.listen(PORT, () => console.log(`[tyler-stub] http://localhost:${PORT}`));
