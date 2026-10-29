/* VRL adapter retained from the successfully tested separate demo. */
var VRL_TEST={url:'https://vrlgroup.in/Tracking/TrackShipment'};
function vrlFetchResult_(lr) {
  var jar = {}, page = vrlRequest_(VRL_TEST.url, 'get', null, jar);
  var problem = vrlProblem_(page);
  if (problem) return problem;
  var tree = vrlTree_(page.body);
  var form = vrlFind_(tree, function(n) { return n.tag === 'form' && n.attrs.id === 'trackingForm'; });
  if (!form) throw Error('VRL form changed or needs a browser. No submission made.');
  if ((form.attrs.method || '').toLowerCase() !== 'post' ||
      vrlAllowedUrl_(form.attrs.action) !== VRL_TEST.url) throw Error('VRL form address or method changed. No submission made.');
  var payload = {};
  vrlWalk_(form, function(n) {
    if (n.tag === 'input' && n.attrs.type === 'hidden' && n.attrs.name) payload[n.attrs.name] = n.attrs.value || '';
  });
  if (!vrlFind_(form, function(n) { return n.tag === 'input' && n.attrs.name === 'lrno'; })) {
    throw Error('VRL LR field changed. No submission made.');
  }
  payload.lrno = lr;
  var response = vrlRequest_(VRL_TEST.url, 'post', payload, jar);
  problem = vrlProblem_(response); if (problem) return problem;
  return vrlAnalyse_(response.body, lr, response.code);
}

// Follow only normal redirects to the same official tracking path.
// Never forward a form token/cookie to another domain, login page or protocol.
function vrlAllowedUrl_(url) {
  url = String(url || '').replace(/&amp;/g, '&');
  if (url.charAt(0) === '/' && url.charAt(1) !== '/') url = 'https://vrlgroup.in' + url;
  if (!/^https:\/\/vrlgroup\.in\/Tracking\/TrackShipment(?:\?[^#\s]*)?$/i.test(url)) {
    throw Error('Unexpected redirect/address. Open the official page manually; no automatic follow-up made.');
  }
  return url;
}
function vrlRequest_(url, method, payload, jar) {
  for (var hop = 0; hop < 4; hop++) {
    url = vrlAllowedUrl_(url);
    var headers = {Accept: 'text/html'};
    var cookies = Object.keys(jar).map(function(k) { return k + '=' + jar[k]; }).join('; ');
    if (cookies) headers.Cookie = cookies;
    var options = {method: method, followRedirects: false, muteHttpExceptions: true, headers: headers};
    if (method === 'post') options.payload = payload;
    var response = UrlFetchApp.fetch(url, options), code = response.getResponseCode(), hs = response.getAllHeaders();
    Object.keys(hs).forEach(function(k) {
      if (k.toLowerCase() !== 'set-cookie') return;
      var values = Array.isArray(hs[k]) ? hs[k] : [hs[k]];
      values.forEach(function(v) { String(v).split(/,(?=\s*[^;,=\s]+=[^;,]*)/).forEach(function(c) {
        var pair = c.trim().split(';')[0], eq = pair.indexOf('=');
        if (eq > 0) jar[pair.slice(0, eq)] = pair.slice(eq + 1);
      }); });
    });
    if ([301, 302, 303, 307, 308].indexOf(code) < 0) {
      var body = response.getContentText();
      if (body.length > 1500000) throw Error('VRL response unexpectedly large; inspect manually.');
      return {code: code, body: body};
    }
    var key = Object.keys(hs).find(function(k) { return k.toLowerCase() === 'location'; });
    if (!key) throw Error('Redirect without destination.');
    url = vrlAllowedUrl_(hs[key]);
    if ([301, 302, 303].indexOf(code) >= 0) { method = 'get'; payload = null; }
  }
  throw Error('Too many redirects. Check manually.');
}
function vrlProblem_(r) {
  var blocked = [401, 403, 429].indexOf(r.code) >= 0 || /captcha|verify you are human|cf-chl-|challenge-platform|access denied/i.test(r.body);
  if (blocked || r.code !== 200) return {outcome: blocked ? 'AUTOMATION BLOCKED' : 'HTTP ERROR', code: r.code, matched: false,
    text: 'No tracking result accepted.', next: blocked ? 'Stop automated testing. VRL requires a human check or has restricted access. Open its official page manually.' : 'VRL returned HTTP ' + r.code + '. Try the official page manually; this is not shipment status.'};
  return null;
}

// Small HTML reader for this diagnostic. It never runs scripts or renders remote HTML.
function vrlDecode_(s) {
  var named = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', bull:'•', ndash:'–', mdash:'—'};
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function(all, entity) {
    if (entity.charAt(0) !== '#') return named[entity.toLowerCase()] || all;
    var n = entity.charAt(1).toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
}
function vrlTree_(html) {
  html = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  var root = {tag: 'root', attrs: {}, children: []}, stack = [root];
  var tokens = html.match(/<[^>]*>|[^<]+/g) || [];
  tokens.forEach(function(t) {
    var close = t.match(/^<\/([a-z0-9]+)/i), open = t.match(/^<([a-z0-9]+)\b/i);
    if (close) {
      for (var i = stack.length - 1; i > 0; i--) if (stack[i].tag === close[1].toLowerCase()) { stack.length = i; break; }
    } else if (open) {
      var n = {tag: open[1].toLowerCase(), attrs: {}, children: []}, rx = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, m;
      var rest = t.slice(open[0].length, -1);
      while ((m = rx.exec(rest))) n.attrs[m[1].toLowerCase()] = vrlDecode_(m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] || '');
      stack[stack.length - 1].children.push(n);
      if (!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(n.tag) && !/\/>$/.test(t)) stack.push(n);
    } else if (t.charAt(0) !== '<') stack[stack.length - 1].children.push({tag: '#text', text: vrlDecode_(t), attrs: {}, children: []});
  });
  return root;
}
function vrlWalk_(n, f) { f(n); n.children.forEach(function(c) { vrlWalk_(c, f); }); }
function vrlFind_(n, predicate) {
  if (predicate(n)) return n;
  for (var i = 0; i < n.children.length; i++) { var found = vrlFind_(n.children[i], predicate); if (found) return found; }
  return null;
}
function vrlText_(n) {
  if (/^(script|style|form|input|button|nav|footer|noscript)$/.test(n.tag) ||
      Object.prototype.hasOwnProperty.call(n.attrs, 'hidden') || n.attrs['aria-hidden'] === 'true' ||
      /(?:^|\s)(?:d-none|hidden)(?:\s|$)/.test(n.attrs['class'] || '') ||
      /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.attrs.style || '')) return '';
  if (n.tag === '#text') return n.text.replace(/\s+/g, ' ');
  if (n.tag === 'br') return '\n';
  var block = /^(div|p|section|h[1-6]|tr|li|header)$/.test(n.tag);
  return (block ? '\n' : '') + n.children.map(vrlText_).join(n.tag === 'tr' ? ' | ' : '') + (block ? '\n' : ' ');
}
function vrlAnalyse_(html, lr, code) {
  var tree = vrlTree_(html), area = vrlFind_(tree, function(n) { return /(?:^|\s)track-page(?:\s|$)/.test(n.attrs['class'] || ''); });
  if (!area) return {outcome:'RESULT FORMAT CHANGED', code:code, matched:false, text:'No recognised tracking-result area.', next:'Send the outcome screenshot. A parser change or browser may be needed; no shipment status inferred.'};
  var text = vrlText_(area).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  var match = new RegExp('(^|[^0-9])' + lr + '([^0-9]|$)').test(text);
  var negative = /please enter|invalid|not found|no (?:tracking |shipment |consignment )?(?:data|details|records)|does not exist/i.test(text);
  var sample = /NDLSF776567DS|K3G Furnishing/i.test(text);
  var good = match && !negative && !sample && text.length > lr.length + 15;
  return {outcome:good ? 'RESPONSE FOUND — VERIFY MANUALLY' : negative ? 'NO VALID RESULT RETURNED' : 'RESULT NOT VERIFIED',
    code:code, matched:good, text:text || 'No visible tracking text returned.', next:good ?
    'Compare B14 against VRL in your browser for this exact LR. If they match, share the result screenshot; direct fetching worked for this test.' :
    'Check the same LR manually on VRL. If the browser works but this test does not, share the outcome and result text. No tracking or delivery status has been assumed.'};
}
function vrlCell_(text) { text = String(text); return /^[=+@-]/.test(text) ? "'" + text : text; }
