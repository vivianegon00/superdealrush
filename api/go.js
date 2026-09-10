// /api/go.js — redirect de afiliado que repassa o click id do Google Ads para a ClickBank.
//
// POR QUE ISSO EXISTE
// Antes, o redirect era estático no vercel.json e mandava `tid=gads1` fixo. Resultado: toda venda
// voltava com o mesmo TID, sem o gclid, e o upload de conversão offline pro Google Ads não tinha
// como casar a venda com o clique. O JS da presell (audifort/index.html) já anexa o gclid ao link
// /go/audifort desde 08/09/2026 — faltava esta metade.
//
// COMO FUNCIONA
// A conta usa o template "Google Ads" do Postback/Pixels da ClickBank (integração
// "Google Ads - Audifort", role Affiliate, Customer ID 617-242-4041, nível Global, eventos
// Initial Purchase + Upsell Purchase → conversion action "ClickBank Sale (Import)").
// Esse template manda a conversão direto pela Conversions API do Google — não há upload manual.
//
// O template exige o click id no parâmetro **`gclid`** da hoplink. Não é `tid` e não é `extclid`.
// A própria tela de edição da integração avisa: "This integration requires the Google Click ID
// (gclid) is passed to your ClickBank affiliate tracking link using 'gclid' URL parameter".
// Doc: https://support.clickbank.com/en/articles/10535368-tracking-integration-google-ads
//
// Caracteres válidos nos parâmetros de tracking: a-z A-Z 0-9 espaço _ - +
// O gclid é base64url (A-Za-z0-9-_), então cabe inteiro, sem encoding.
//
// Mandamos `extclid` junto só para o valor aparecer no relatório de transações da ClickBank.
// Quem faz a atribuição funcionar é o `gclid`.
//
// PRÉ-REQUISITO: auto-tagging LIGADO no Google Ads. Sem isso o Google não anexa ?gclid= na URL
// de destino, o JS da presell não tem o que capturar, e nada disso funciona.

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
      // gclid é o que a integração Google Ads da ClickBank exige. Sem ele, sem conversão.
      dest.searchParams.set('gclid', clean);
      // extclid é redundante para a atribuição, mas faz o valor aparecer no relatório da ClickBank.
      dest.searchParams.set('extclid', clean);
      dest.searchParams.set('traffic_type', 'paid');
      dest.searchParams.set('traffic_source', 'google');
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
