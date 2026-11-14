"""Inside the isolated WSL GPU container: verify local artifacts, start and stop one server."""
import hashlib, json, os, platform, resource, secrets, subprocess, time, urllib.request
from pathlib import Path

def digest(path):
    with open(path, 'rb') as src:
        return hashlib.file_digest(src, 'sha256').hexdigest()

out = Path('/evidence')
model = Path('/gpu/Qwen3-4B-Instruct-2507-Q4_K_M.gguf')
server = Path('/gpu/llama.cpp/build/bin/llama-server')
manifest = json.loads(Path('/release/docker/open-weight-llm/model-manifest.json').read_text())
assert model.stat().st_size == manifest['sizeBytes'] and digest(model) == manifest['sha256']
env = dict(os.environ, PATH='/release/.study-node:'+os.environ['PATH'], OPEN_WEIGHT_LLM_ENABLED='true',
           OPEN_WEIGHT_LLM_URL='http://127.0.0.1:8080', STUDY_TOKEN=secrets.token_urlsafe(32))
env['LD_LIBRARY_PATH']=str(server.parent)+':'+env.get('LD_LIBRARY_PATH','')
env['OPEN_WEIGHT_LLM_TOKEN'] = env['STUDY_TOKEN']
# Do not put a token in command-line logs or the experiment manifest.
env['LLAMA_API_KEY'] = env['STUDY_TOKEN']
args = [str(server),'--model',str(model),'--alias','qwen3-4b-instruct-2507-q4_k_m','--host','127.0.0.1',
        '--port','8080','--ctx-size','8192','--parallel','1','--threads','4','--threads-batch','4','--batch-size','256',
        '--ubatch-size','128','--n-gpu-layers','99','--n-predict',('640' if os.environ['SERIE']=='640' else '1024'),'--reasoning','off','--jinja','--offline','--no-webui',
        '--slots','--slot-save-path','/tmp','--cache-ram','0','--slot-prompt-similarity','0','--log-verbosity','4']
files=['package-lock.json','prisma/schema.prisma','apps/backend/src/lib/moderationSummaryContext.ts','apps/backend/src/lib/moderationPromptContextPacking.ts','apps/backend/src/lib/qaSummaryValidateV2.ts','apps/backend/src/lib/qaSummaryRuntimeAdapter.ts','apps/backend/src/lib/qaSummaryQuality.ts','apps/backend/src/lib/openWeightLlmClient.ts','apps/backend/src/lib/topic2c.experiment.test.ts','libs/shared-types/src/moderation-prompt-context-fixtures.ts']
meta=dict(release='1d71bd9583954d5304e3d56ee2cc716196190a65', series=os.environ['SERIE'],linux=platform.release(),os=platform.freedesktop_os_release()['PRETTY_NAME'],
          cpu=next(x.split(':',1)[1].strip() for x in Path('/proc/cpuinfo').read_text().splitlines() if x.startswith('model name')), visibleCpu=os.cpu_count(),meminfo=Path('/proc/meminfo').read_text().splitlines()[:3],
          quota={s:Path('/sys/fs/cgroup',s).read_text().strip() for s in ('memory.max','cpu.max')},model=manifest,serverSha=digest(server),node=subprocess.check_output(['/release/.study-node/node','--version'],text=True).strip(),
          sources={f:digest(Path('/release',f)) for f in files},startScriptSha=digest(__file__),args=args,db='in-memory synthetic analysis snapshot; no DB, Redis or browser',started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
(out/'environment.json').write_text(json.dumps(meta,indent=2))
with open(out/'server.full.log','x') as log:
    process=subprocess.Popen(args,env=env,stdout=log,stderr=subprocess.STDOUT)
    start=time.monotonic()
    try:
        while time.monotonic()-start<90:
            if process.poll() is not None: raise SystemExit('Server startup failed; see server.full.log')
            try:
                with urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=2) as health:
                    if health.status==200:break
            except OSError: time.sleep(.25)
        else: raise SystemExit('Startup timeout')
        meta['startupSeconds']=time.monotonic()-start
        assert 'offloaded 37/37 layers to GPU' in (out/'server.full.log').read_text()
        cmd=['/release/.study-node/node','../../node_modules/vitest/vitest.mjs','run','--maxWorkers=1','src/lib/topic2c.experiment.test.ts']
        with open(out/'experiment.log','x') as exp:
            status=subprocess.run(cmd,env=env,stdout=exp,stderr=subprocess.STDOUT,timeout=760).returncode
        raise SystemExit(status)
    finally:
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill();process.wait()
        meta['childrenMaxRssKiB']=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
        (out/'environment.json').write_text(json.dumps(meta,indent=2)+'\n')
