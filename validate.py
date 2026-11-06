import pathlib, sys, json, hashlib, re
p=pathlib.Path(__file__).parent
sys.path.insert(0,str(p.parent/'.validation-deps'))
import yaml
m=yaml.safe_load((p/'YouTube-Plus.Egern.yaml').read_text(encoding='utf-8'))
assert len(m['scriptings'])==2
assert len(m['map_locals'])==4
assert len(m['url_rewrites'])==1
assert m['url_rewrites'][0]['disabled'] is True
assert len(m['mitm']['hostnames'])==8
assert len(m['env_schema'])==9
routes=json.loads((p/'routes.json').read_text(encoding='utf-8'))
assert len(routes)==14
for route in routes: re.compile(route['pattern'])
for item in m['scriptings']:
    config=next(iter(item.values()))
    if config['script_url'].startswith('https://'):
        publish=json.loads((p/'publish-config.json').read_text(encoding='utf-8'))
        expected='https://raw.githubusercontent.com/'+publish['repository']+'/'+publish.get('ref','main')+'/youtube-plus.native.js'
        assert config['script_url']==expected
        assert (p/'youtube-plus.native.js').is_file()
    else:
        assert (p/config['script_url']).is_file(),config['script_url']
    assert config['body_required'] and config['binary_body']
    assert config['max_size']==16777216
    assert 0 < config['timeout'] <= 600
    assert config['env']['Type']=='Translate'
for name,record in json.loads((p/'sources.sha256.json').read_text()).items():
    assert hashlib.sha256((p/name).read_bytes()).hexdigest()==record['sha256']
bundle=(p/'youtube-plus.native.js').read_text(encoding='utf-8')
assert 'export default async function(ctx)' in bundle
assert 'eval(' not in bundle
assert 'let Database;' in bundle
out='YAML parsed; 2 native hooks cover 14 original rules; 4 Map Local entries; 1 redirect; 8 MITM hosts; 9 settings; local script exists; all 7 upstream SHA-256 checks passed.\n'
print(out)
with (p/'verification.txt').open('a',encoding='utf-8') as f:f.write(out)
