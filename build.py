import sys, pathlib, re, json, hashlib
sys.path.insert(0,str(pathlib.Path(__file__).parent.parent/'.validation-deps'))
import yaml
p=pathlib.Path(__file__).parent
publish_config=p/'publish-config.json'
publish=json.loads(publish_config.read_text(encoding='utf-8')) if publish_config.exists() else None
if publish:
    assert re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',publish['repository'])
    assert re.fullmatch(r'[A-Za-z0-9_.-]+',publish.get('ref','main'))
source=(p/'original.sgmodule').read_text(encoding='utf-8')
routes=[]
for line in source.splitlines():
    if ' = type=http-' not in line and '= type=http-' not in line and '=type=http-' not in line: continue
    name,fields=line.split('=',1)
    values={k.strip():v.strip() for k,v in (part.split('=',1) for part in fields.split(',') if '=' in part)}
    routes.append(dict(name=name.strip(),type=values['type'],pattern=values['pattern'],file=values['script-path'].rsplit('/',1)[1],binary=values.get('binary-body-mode')=='true',body=values.get('requires-body')=='true',keys=re.findall(r'(\w+)=\{\{\{',values.get('argument',''))))
assert len(routes)==14,len(routes)
programs=[]
for file in sorted(set(r['file'] for r in routes)):
    # Function-local bindings retain upstream logic but expose only audited host APIs.
    code=(p/file).read_text(encoding='utf-8')
    if file=='youtube-subtitles-request.js':
        # Upstream incorrectly mutates the URL constructor instead of parsed request URL.
        code=code.replace('a.set(URL,"query.subtype","Translate")','xe.searchParams.set("subtype","Translate")').replace('a.set(URL,"query.subtype","External")','xe.searchParams.set("subtype","External")')
    programs.append(json.dumps(file)+': function({$request,$response,$argument,$environment,$script,$done,$persistentStore,$notification,$httpClient}) {\nlet Database;\n'+code+'\n}')
bundle=(p/'bridge.js').read_text(encoding='utf-8')+'\nconst ROUTES = '+json.dumps(routes)+';\nconst PROGRAMS = {\n'+',\n'.join(programs)+'\n};\n'
(p/'youtube-plus.native.js').write_text(bundle,encoding='utf-8')
defaults=dict(blockUpload='true',blockImmersive='true',blockShorts='true',subsTabOnly='true',debug='false',Type='Translate',AutoCC='false',ShowOnly='false',Position='Forward')
module=dict(name='YouTube Plus — Egern Native',description='Egern 2.20 target; bundled upstream logic through native ctx API. Read README before import.',author='gogrhw + Maasea + Aioneas + QingRex + VirgilClyne; native adapter by Codex',homepage='https://github.com/gogrhw/surge',env_schema={k:dict(name=k,default_value=v,options=['Official','Translate'] if k=='Type' else ['Forward','Reverse'] if k=='Position' else ['true','false']) for k,v in defaults.items()})
module['url_rewrites']=[]
for line in source.split('[URL Rewrite]')[1].split('[Map Local]')[0].splitlines():
    if line.startswith('^'):
        match,location,status=line.split()
        # Upstream has only two groups but references $3; do not enable a broken redirect.
        module['url_rewrites'].append(dict(match=match,location=location,status_code=int(status),disabled=True))
# Exact space body and status preserved with native Map Local.
module['map_locals']=[]
for line in source.split('[Map Local]')[1].split('[Script]')[0].splitlines():
    if line.startswith('^'): module['map_locals'].append(dict(match=line.split(' data-type=')[0],status_code=200,body=' ',headers={'Content-Type':'text/plain'}))
module['scriptings']=[]
for kind in ['http_request','http_response']:
    patterns=list(dict.fromkeys(r['pattern'] for r in routes if r['type']==kind.replace('_','-')))
    module['scriptings'].append({kind:dict(name='YouTube Plus Native '+kind,match='(?:'+'|'.join(patterns)+')',script_url='youtube-plus.native.js',body_required=True,binary_body=True,max_size=16777216,timeout=120,env=dict(defaults))})
module['mitm']={'hostnames':source.split('hostname = %APPEND% ')[1].strip().split(', ')}
if publish:
    base='https://raw.githubusercontent.com/'+publish['repository']+'/'+publish.get('ref','main')+'/'
    module['homepage']='https://github.com/'+publish['repository']
    module['manual']=base+'README.md'
    for hook in module['scriptings']:
        config=next(iter(hook.values()))
        config['script_url']=base+'youtube-plus.native.js'
        config['update_interval']=86400
(p/'YouTube-Plus.Egern.yaml').write_text(yaml.safe_dump(module,allow_unicode=True,sort_keys=False),encoding='utf-8')
(p/'routes.json').write_text(json.dumps(routes,ensure_ascii=False,indent=2),encoding='utf-8')
manifest={f.name:dict(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in [p/'original.sgmodule']+[p/file for file in sorted(set(r['file'] for r in routes))]}
(p/'sources.sha256.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Built',len(routes),'routes;',len(programs),'bundled scripts;',len(bundle),'characters')


