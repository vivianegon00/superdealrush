#!/usr/bin/env node
// Mostra a URL final que /api/go vai gerar para um gclid, sem precisar publicar nada.
//
// Uso:
//   node tools/preview-link.js                      # sem click id (tráfego orgânico)
//   node tools/preview-link.js <gclid>              # com gclid
//   node tools/preview-link.js <gclid> <offer>      # outra oferta

const handler = require('../api/go.js');
const { OFFERS } = handler;

const [gclid, offer = 'audifort'] = process.argv.slice(2);

const query = new URLSearchParams({ offer });
if (gclid) query.set('gclid', gclid);

const req = { url: `/api/go?${query}`, headers: { host: 'superdealrush.com' } };

const res = {
  statusCode: 0,
  headers: {},
  setHeader(k, v) {
    this.headers[k.toLowerCase()] = v;
  },
  end(body) {
    if (this.statusCode === 302) {
      const dest = this.headers.location;
      console.log(`status   : ${this.statusCode}`);
      console.log(`destino  : ${dest}`);
      const parsed = new URL(dest);
      const ext = parsed.searchParams.get('extclid');
      console.log(`extclid  : ${ext || '(nenhum)'}`);
      if (ext) {
        console.log(`  bate com o gclid original? ${ext === gclid ? 'SIM' : 'NAO — foi sanitizado'}`);
        console.log(`  tamanho: ${ext.length} / 256`);
      }
    } else {
      console.log(`status   : ${this.statusCode}`);
      console.log(`corpo    : ${body}`);
    }
  },
};

if (!OFFERS[offer]) {
  console.error(`Oferta desconhecida: ${offer}. Disponíveis: ${Object.keys(OFFERS).join(', ')}`);
  process.exit(1);
}

handler(req, res);
