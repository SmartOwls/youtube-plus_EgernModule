import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('youtube-plus.native.js',import.meta.url),'utf8');
const {default:main,runLegacy,nativeResult,applyPatch} = await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {runLegacy,nativeResult,applyPatch};').toString('base64'));
const logs=[];
const log=console.log;
console.log=(...args)=>logs.push(args.join(' '));
const store=new Map();
function context(url,body,response=false,env={}) {
  let reads=0;
  const message={body:body==null?null:{},headers:new Headers({'content-type':typeof body==='string'?'application/json':'application/x-protobuf'}),
    async text(){assert.equal(++reads,1);return typeof body==='string'?body:new TextDecoder().decode(body)},
    async arrayBuffer(){assert.equal(++reads,1);return Uint8Array.from(typeof body==='string'?new TextEncoder().encode(body):body).buffer}};
  return {request:response?{url,method:'POST',headers:new Headers()}:Object.assign(message,{url,method:'POST'}),
    response:response?Object.assign(message,{status:200}):undefined,env,
    storage:{get:k=>store.get(k)??null,set:(k,v)=>store.set(k,v)},notify:()=>{},respond:r=>({direct:r}),
    http:{get:async()=>new Response('translated',{status:200})}};
}
let count=0;
async function test(name,fn){await fn();count++;log('PASS '+name)}
await test('unmatched URL passes without consuming body',async()=>assert.equal(await main(context('https://example.com/',null)),undefined));
const encode=s=>new TextEncoder().encode(s);
function browse(s){return Uint8Array.from([18,s.length,...encode(s),24,7]);}
await test('real upstream protobuf Home -> Subscriptions, other fields retained',async()=>{
  const r=await main(context('https://youtubei.googleapis.com/youtubei/v1/browse?key=x',browse('FEwhat_to_watch')));
  assert.deepEqual(r.body,browse('FEsubscriptions'));
});
await test('subsTabOnly=false preserves Home protobuf',async()=>{
  const b=browse('FEwhat_to_watch');const r=await main(context('https://youtubei.googleapis.com/youtubei/v1/browse?key=x',b,false,{subsTabOnly:'false'}));assert.deepEqual(r.body,b);
});
await test('non-Home protobuf preserved',async()=>{const b=browse('FElibrary');assert.deepEqual((await main(context('https://youtubei.googleapis.com/youtubei/v1/browse?key=x',b))).body,b)});
await test('real upstream Player protobuf pipeline completes',async()=>{
  const r=await main(context('https://youtubei.googleapis.com/youtubei/v1/player?key=x',new Uint8Array(),true));assert.ok(r.body instanceof Uint8Array);
});
await test('real upstream JSON subtitle request remains valid JSON',async()=>{
  const r=await main(context('https://www.youtube.com/youtubei/v1/player?key=x',JSON.stringify({context:{client:{clientName:'WEB',clientVersion:'1'}},videoId:'test'})));
  assert.equal(JSON.parse(r.body).videoId,'test');
});
await test('real upstream JSON subtitle response remains valid JSON',async()=>{
  const r=await main(context('https://www.youtube.com/youtubei/v1/player?key=x',JSON.stringify({videoDetails:{videoId:'test'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[],audioTracks:[]}}}),true));assert.ok(JSON.parse(r.body));
});
await test('timedtext request routes and adds subtitle subtype',async()=>{
  const c=context('https://www.youtube.com/api/timedtext?v=test&lang=en&tlang=zh&fmt=json3',null);c.request.method='GET';const r=await main(c);assert.match(r.url,/subtype=Translate/);
});
await test('real upstream Player removes adPlacements and adSlots protobuf fields',async()=>{
  // field 7 and field 68 contain empty ad messages; unknown field 100 is retained.
  const b=Uint8Array.from([58,0,162,4,0,160,6,1]);
  const r=await main(context('https://youtubei.googleapis.com/youtubei/v1/player',b,true));
  assert.deepEqual(r.body,Uint8Array.from([160,6,1]));
});
await test('Music protobuf lyrics request selects Translate response route',async()=>{
  const r=await main(context('https://youtubei.googleapis.com/youtubei/v1/browse?key=x',browse('MPLYt_test')));
  assert.match(r.url,/subtype=Translate/);
});
await test('Music JSON lyrics request selects Translate response route',async()=>{
  const r=await main(context('https://music.youtube.com/youtubei/v1/browse?key=x',JSON.stringify({browseId:'MPLYt_test',context:{client:{clientName:'WEB_REMIX'}}})));
  assert.match(r.url,/subtype=Translate/);
});
await test('real upstream subtitle Translate JSON3 with mocked Google result',async()=>{
  const c=context('https://www.youtube.com/api/timedtext?v=test&lang=en&fmt=json3&subtype=Translate',JSON.stringify({events:[{tStartMs:0,dDurationMs:1000,segs:[{utf8:'Hello'}]}]}),true);
  c.request.method='GET';let fetched=0;
  for(const method of ['get','post']) c.http[method]=async(url,opts)=>{fetched++;return new Response(JSON.stringify([[["你好","Hello",null,null,1]],null,"en"]),{status:200,headers:{'content-type':'application/json'}})};
  const r=await main(c);assert.ok(fetched>0);assert.match(r.body,/你好/);assert.match(r.body,/Hello/);
});
await test('bridge HTTP binary, seconds-to-ms, policy, storage and notification',async()=>{
  const c=context('',null);let notified=false;c.notify=()=>{notified=true};c.http.get=async(url,opts)=>{assert.equal(url,'https://example.com/');assert.equal(opts.timeout,2000);assert.equal(opts.policy,'DIRECT');return new Response(Uint8Array.from([0,255]),{status:201,headers:{'X-Test':'yes'}})};
  const result=await runLegacy(api=>{api.$persistentStore.write('value','key');assert.equal(api.$persistentStore.read('key'),'value');api.$notification.post('a','b','c');api.$httpClient.get({url:'https://example.com/','binary-mode':true,timeout:2,policy:'DIRECT'},(error,r,b)=>{assert.equal(error,null);assert.equal(r.status,201);assert.equal(r.headers['x-test'],'yes');api.$done({body:b})})},c,{},undefined,'','fixture');
  assert.deepEqual(result.body,Uint8Array.from([0,255]));assert.ok(notified);
});
await test('bodyBytes overrides body; invalid length/encoding headers removed',async()=>{
  const target={body:'old',headers:{'Content-Length':'30','Content-Encoding':'gzip','Content-Type':'text/plain'}};applyPatch(target,{bodyBytes:Uint8Array.from([1,2])});const r=nativeResult(target,true);assert.deepEqual(r.body,Uint8Array.from([1,2]));assert.equal(r.headers['content-length'],undefined);assert.equal(r.headers['content-encoding'],undefined);assert.equal(r.headers['content-type'],'text/plain');
});
console.log=log;
const errorLogs=logs.filter(s=>/YouTube Plus:|执行错误|執行錯誤|can not get binaryBody/.test(s));
if(errorLogs.length){log(errorLogs.join('\n'));throw new Error('Upstream error logs detected')}
log(`Passed ${count} tests. No live iOS/YouTube test performed.`);
await fs.writeFile(new URL('verification.txt',import.meta.url),`Node ${process.version}\nPassed ${count} adapter/fixture tests.\nJavaScript syntax: passed.\nYAML/dependency validation: see validate.py output.\nNot tested in Egern/iOS or against live YouTube.\n`);




