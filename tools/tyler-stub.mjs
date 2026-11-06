/* Faux Tyler pour les essais locaux et les e2e — jamais en production.
 *
 *   node tools/tyler-stub.mjs            écoute sur :4010 (PORT pour changer)
 *   TYLER_URL=http://localhost:4010 TYLER_WEBCHAT_SECRET=stub TYLER_CHAT_FORCE=1 npm run dev
 *
 * Mêmes 3 routes que l'app Tyler (/api/webchat/status|presence|turn). `?fail=1` sur
 * n'importe laquelle répond 500. Le secret n'est pas vérifié : c'est un bouchon.
 * Le corps reçu par /turn est imprimé, pour voir l'écran reconstruit par la LP.
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || 4010);

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (u.searchParams.get('fail') === '1') return send(500, { error: 'stub failure' });

  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (u.pathname === '/api/webchat/status' && req.method === 'GET') {
      return send(200, { enabled: true, firstName: 'Alex' });
    }
    if (u.pathname === '/api/webchat/presence' && req.method === 'POST') {
      return send(200, { ok: true });
    }
    if (u.pathname === '/api/webchat/turn' && req.method === 'POST') {
      console.log('[tyler-stub] turn', body);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const ev = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
      ev({ type: 'typing' });
      setTimeout(() => {
        ev({ type: 'message', text: "Quick check, it's a 2021 M3 you're working with?" });
        ev({ type: 'done' });
        res.end();
      }, 300);
      return;
    }
    send(404, { error: 'not found' });
  });
});

server.listen(PORT, () => console.log(`[tyler-stub] http://localhost:${PORT}`));
