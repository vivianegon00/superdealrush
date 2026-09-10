// /api/go.js — redirect de afiliado que repassa o click id do Google Ads para a ClickBank.
//
// POR QUE ISSO EXISTE
// Antes, o redirect era estático no vercel.json e mandava `tid=gads1` fixo. Resultado: toda venda
// voltava com o mesmo TID, sem o gclid, e o upload de conversão offline pro Google Ads não tinha
// como casar a venda com o clique. O JS da presell (audifort/index.html) já anexa o gclid ao link
// /go/audifort desde 08/09/2026 — faltava esta metade.
//
// COMO FUNCIONA
// A ClickBank tem um parâmetro dedicado a click id de terceiros: `extclid` (máx. 256 caracteres).
// Caracteres válidos nos parâmetros de tracking: a-z A-Z 0-9 espaço _ - +
// O gclid é base64url (A-Za-z0-9-_), então cabe inteiro, sem encoding.
// Doc: https://support.clickbank.com/en/articles/10535262-affiliate-tracking-parameters
//
// Para receber o extclid de volta na venda, o postback S2S da ClickBank precisa incluir o token
// do extclid na URL configurada (Accounts > Integrations > Postback). Sem isso, o dado é gravado
// na ClickBank mas não chega ao Google Ads.

const OFFERS = {
  audifort: {
    hoplink: 'https://3e803qkis8gbxp84x9naqjuy0j.hop.clickbank.net/',
    campaign: 'audifort-tinnitus-search',
  },
};

const MAX_EXTCLID = 256;
const VALID_CHARS = /[^A-Za-z0-9_+-]/g; // espaço também é válido, mas não aparece em click id

function sanitizeClickId(raw) {
  return String(raw).replace(VALID_CHARS, '').slice(0, MAX_EXTCLID);
}

module.exports = (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const offerKey = (url.searchParams.get('offer') || 'audifort').toLowerCase();
  const offer = OFFERS[offerKey];

  if (!offer) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Unknown offer');
  }

  // gclid é o caso normal; gbraid/wbraid aparecem em contexto sem cookie (iOS/Safari).
  const clickId =
    url.searchParams.get('gclid') ||
    url.searchParams.get('gbraid') ||
    url.searchParams.get('wbraid') ||
    '';

  const dest = new URL(offer.hoplink);

  if (clickId) {
    const clean = sanitizeClickId(clickId);
    if (clean) {
      dest.searchParams.set('extclid', clean);
      dest.searchParams.set('traffic_type', 'paid');
      dest.searchParams.set('traffic_source', 'googleAds');
      dest.searchParams.set('campaign', offer.campaign);
    }
  } else {
    // Sem click id: tráfego direto/orgânico. Marcado para não poluir o relatório de paid.
    dest.searchParams.set('traffic_type', 'organic');
    dest.searchParams.set('campaign', offer.campaign);
  }

  res.statusCode = 302;
  res.setHeader('Location', dest.toString());
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.end();
};

module.exports.sanitizeClickId = sanitizeClickId;
module.exports.OFFERS = OFFERS;
