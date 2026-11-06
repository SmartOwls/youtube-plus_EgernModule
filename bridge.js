// Native Egern entry support. Upstream programs are statically bundled below.
// No eval, remote code loading, or reliance on Egern's Surge module importer.
const DEFAULTS = {blockUpload:'true',blockImmersive:'true',blockShorts:'true',subsTabOnly:'true',debug:'false',Type:'Translate',AutoCC:'false',ShowOnly:'false',Position:'Forward'};
const bytes = x => x instanceof Uint8Array ? x : x instanceof ArrayBuffer ? new Uint8Array(x) : new TextEncoder().encode(typeof x === 'string' ? x : JSON.stringify(x));
function headers(h) {
  const out = {};
  if (h?.forEach) h.forEach((v,k) => { out[k.toLowerCase()] = v; });
  else for (const [k,v] of Object.entries(h || {})) out[k.toLowerCase()] = v;
  return out;
}
async function snapshot(obj, binary, readBody) {
  if (!obj) return undefined;
  const out = {url:obj.url, method:obj.method, status:obj.status, headers:headers(obj.headers)};
  if (readBody && obj.body != null) {
    out.body = binary ? new Uint8Array(await obj.arrayBuffer()) : await obj.text();
    if (binary) out.bodyBytes = out.body;
  }
  return out;
}
async function runLegacy(program, ctx, req, res, argument, name) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(name + ': upstream completion timeout')), 55000);
    let finished = false;
    const finish = result => { if (!finished) { finished = true; clearTimeout(timer); resolve(result || {}); } };
    const storeKey = key => 'YouTubePlus.Egern.' + key;
    const api = {
      $request:req, $response:res, $argument:argument,
      // Select the audited Surge code paths within the bundled upstream code.
      $environment:{'surge-version':'egern-native-bridge'},
      $script:{name, startTime:Date.now()/1000}, $done:finish,
      $persistentStore:{
        read:key => ctx.storage.get(storeKey(key)),
        write:(value,key) => { ctx.storage.set(storeKey(key), String(value)); return true; }
      },
      $notification:{post:(title,subtitle,body) => ctx.notify({title,subtitle,body})},
      $httpClient:{}
    };
    for (const method of ['get','post','put','delete','head','options','patch']) {
      api.$httpClient[method] = (input, callback) => {
        const o = typeof input === 'string' ? {url:input} : input;
        const opts = {headers:o.headers, body:o.bodyBytes ?? o.body};
        if (o.timeout != null) opts.timeout = Number(o.timeout)*1000;
        if (o.policy) opts.policy = o.policy;
        if (o['policy-descriptor']) opts.policyDescriptor = o['policy-descriptor'];
        if (o['auto-redirect'] != null) opts.redirect = o['auto-redirect'] ? 'follow' : 'manual';
        if (o['auto-cookie'] != null) opts.credentials = o['auto-cookie'] ? 'include' : 'omit';
        if (o.insecure != null) opts.insecureTls = o.insecure;
        ctx.http[method](o.url,opts).then(async r => {
          const body = o['binary-mode'] ? new Uint8Array(await r.arrayBuffer()) : await r.text();
          if (!finished) callback(null,{status:r.status,statusCode:r.status,headers:headers(r.headers)},body);
        }).catch(e => { if (!finished) callback(String(e),{},null); });
      };
    }
    try { program(api); } catch (e) { clearTimeout(timer); reject(e); }
  });
}
function applyPatch(target, patch) {
  for (const k of ['url','method','status','headers']) if (patch[k] !== undefined) target[k] = patch[k];
  if (patch.bodyBytes !== undefined || patch.body !== undefined) {
    target.body = patch.bodyBytes ?? patch.body;
    target.bodyBytes = typeof target.body === 'string' ? undefined : bytes(target.body);
  }
}
function nativeResult(obj, isResponse) {
  const result = {};
  for (const k of (isResponse ? ['status','headers','body'] : ['url','method','headers','body']))
    if (obj[k] !== undefined) result[k] = obj[k];
  if (typeof result.status === 'string') result.status = Number(result.status.match(/\b\d{3}\b/)?.[0] || 200);
  if (result.body instanceof ArrayBuffer) result.body = new Uint8Array(result.body);
  if (result.headers) {
    result.headers = headers(result.headers);
    delete result.headers['content-length'];
    delete result.headers['content-encoding'];
    delete result.headers['transfer-encoding'];
  }
  return result;
}
export default async function(ctx) {
  const phase = ctx.response ? 'http-response' : 'http-request';
  const initialURL = ctx.request.url;
  const routes = ROUTES.filter(r => r.type === phase && new RegExp(r.pattern).test(initialURL));
  if (!routes.length) return;
  const binary = routes.some(r => r.binary);
  const req = await snapshot(ctx.request,binary,phase === 'http-request');
  const res = await snapshot(ctx.response,binary,phase === 'http-response');
  const target = res || req;
  const args = {...DEFAULTS,...ctx.env};
  for (const route of routes) {
    // Separate clones prevent an unsuccessful upstream script from mutating the pipeline.
    const clone = o => o && {...o,headers:{...o.headers},body:o.body instanceof Uint8Array ? o.body.slice() : o.body,bodyBytes:o.bodyBytes instanceof Uint8Array ? o.bodyBytes.slice() : o.bodyBytes};
    try {
      const argument = route.keys.map(k => k + '=' + args[k]).join('&');
      const patch = await runLegacy(PROGRAMS[route.file],ctx,clone(req),clone(res),argument,route.name);
      if (phase === 'http-request' && patch.response) return ctx.respond(nativeResult(patch.response,true));
      applyPatch(target,patch.response || patch);
    } catch(e) { console.log('YouTube Plus: ' + route.name + ': ' + e.message); }
  }
  return nativeResult(target,!!res);
}
