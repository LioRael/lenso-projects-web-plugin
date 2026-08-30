pub(crate) const PAGE: &str = r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>Lenso Projects</title>
  <link rel="stylesheet" href="/projects/assets/app.css">
</head>
<body>
  <div class="app-shell">
    <aside class="rail">
      <div class="brand"><span class="brand-mark">L</span><span>Lenso</span></div>
      <nav aria-label="Projects navigation">
        <button class="nav-item active" data-view="projects"><span>◆</span> Projects</button>
        <button class="nav-item" data-view="issues"><span>◫</span> Issues</button>
        <button class="nav-item" data-view="updates"><span>◌</span> Updates</button>
      </nav>
      <div class="connection">
        <label for="organization">Organization</label>
        <input id="organization" autocomplete="off" placeholder="org_demo">
        <label for="token">Bearer token</label>
        <input id="token" type="password" autocomplete="off" placeholder="••••••••">
        <button id="connect" class="secondary">Load workspace</button>
        <p id="connection-state" class="muted">Not connected</p>
      </div>
    </aside>
    <main>
      <header class="topbar">
        <div><p class="eyebrow">PRODUCT DEVELOPMENT</p><h1>Projects</h1></div>
        <div class="actions"><button id="refresh" class="icon" title="Refresh">↻</button><button id="new-project">New project</button></div>
      </header>
      <section class="metrics" aria-label="Workspace summary">
        <article><span>Active projects</span><strong id="metric-projects">—</strong></article>
        <article><span>Open issues</span><strong id="metric-issues">—</strong></article>
        <article><span>Current cycle</span><strong id="metric-cycle">—</strong></article>
      </section>
      <section class="workspace">
        <div class="project-column">
          <div class="section-head"><h2>Roadmap</h2><label class="toggle"><input id="show-archived" type="checkbox"> Archived</label></div>
          <div id="projects-list" class="project-list"><div class="empty">Enter an organization and load its workspace.</div></div>
          <button id="load-more-projects" class="ghost hidden">Load more projects</button>
        </div>
        <div class="detail-column">
          <div id="project-detail" class="empty-panel">
            <span class="empty-icon">◇</span><h2>Select a project</h2><p>Inspect its issue queue, status and latest updates.</p>
          </div>
        </div>
      </section>
    </main>
  </div>
  <dialog id="project-dialog">
    <form id="project-form" method="dialog">
      <div class="dialog-head"><div><p class="eyebrow">CREATE</p><h2>New project</h2></div><button type="button" class="icon close" aria-label="Close">×</button></div>
      <label>Name<input name="name" required maxlength="160"></label>
      <label>Summary<textarea name="summary" rows="3" maxlength="2000"></textarea></label>
      <div class="grid-2"><label>Lead team<select name="lead_team_id" required></select></label><label>Status<select name="status_id" required></select></label></div>
      <div class="grid-2"><label>Start date<input name="start_date" type="date"></label><label>Target date<input name="target_date" type="date"></label></div>
      <p id="form-error" class="error"></p>
      <div class="dialog-actions"><button type="button" class="secondary close">Cancel</button><button type="submit">Create project</button></div>
    </form>
  </dialog>
  <div id="toast" role="status" aria-live="polite"></div>
  <script src="/projects/assets/app.js" defer></script>
</body>
</html>"#;

pub(crate) const CSS: &str = r#":root{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e9e9ee;background:#101014;font-synthesis:none;--panel:#17171c;--panel-2:#1d1d23;--line:#2a2a32;--muted:#92929e;--accent:#7c6ff0;--accent-2:#a79df8}*{box-sizing:border-box}body{margin:0;min-width:960px;background:radial-gradient(circle at 72% -20%,#282346 0,transparent 36%),#101014}.app-shell{min-height:100vh;display:grid;grid-template-columns:224px 1fr}.rail{position:sticky;top:0;height:100vh;border-right:1px solid var(--line);padding:22px 14px;display:flex;flex-direction:column;background:rgba(16,16,20,.92);backdrop-filter:blur(18px)}.brand{display:flex;align-items:center;gap:10px;font-weight:680;padding:0 9px 25px}.brand-mark{display:grid;place-items:center;width:29px;height:29px;border-radius:9px;color:white;background:linear-gradient(145deg,var(--accent),#5144b9);box-shadow:0 6px 18px #5a4bd044}nav{display:grid;gap:5px}.nav-item{width:100%;text-align:left;color:#aaaab4;background:transparent}.nav-item.active,.nav-item:hover{background:#23232b;color:#fff}.connection{margin-top:auto;padding:14px 10px;border-top:1px solid var(--line);display:grid;gap:8px}.connection label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.connection input{width:100%}button,input,textarea,select{font:inherit;border:1px solid var(--line);border-radius:8px;color:#ededf2;background:#202027}input,textarea,select{padding:9px 10px;outline:none}input:focus,textarea:focus,select:focus{border-color:var(--accent);box-shadow:0 0 0 3px #7c6ff022}button{border:0;padding:9px 13px;cursor:pointer;background:var(--accent);font-weight:620}button:hover{filter:brightness(1.08)}button.secondary{background:#282830;border:1px solid #34343d}.muted{color:var(--muted);font-size:12px;margin:3px 0 0}main{padding:28px 34px 46px;min-width:0}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.eyebrow{margin:0 0 6px;color:var(--accent-2);font-size:10px;font-weight:700;letter-spacing:.16em}.topbar h1,.dialog-head h2{margin:0;font-size:28px;letter-spacing:-.03em}.actions{display:flex;gap:9px}.icon{width:38px;padding:8px;background:#222229;border:1px solid var(--line)}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}.metrics article{padding:16px 18px;background:linear-gradient(145deg,#1d1d23,#18181e);border:1px solid var(--line);border-radius:12px}.metrics span{display:block;color:var(--muted);font-size:12px}.metrics strong{display:block;margin-top:8px;font-size:21px}.workspace{display:grid;grid-template-columns:minmax(340px,.82fr) minmax(480px,1.18fr);min-height:590px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel)}.project-column{border-right:1px solid var(--line);padding:19px}.detail-column{padding:23px;min-width:0}.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.section-head h2{font-size:14px;margin:0}.toggle{font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center}.project-list{display:grid;gap:7px}.project-card{display:grid;grid-template-columns:9px 1fr auto;gap:11px;align-items:center;padding:13px;border:1px solid transparent;border-radius:10px;cursor:pointer}.project-card:hover,.project-card.selected{background:#23232b;border-color:#32323b}.status-dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}.project-card h3{font-size:13px;margin:0 0 4px}.project-card p{font-size:11px;color:var(--muted);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.project-card time{font-size:10px;color:#777783}.empty,.empty-panel{color:var(--muted);font-size:13px;text-align:center;padding:64px 15px}.empty-panel{display:grid;place-items:center;align-content:center;height:100%}.empty-panel h2{color:#dedee5;margin:12px 0 3px;font-size:17px}.empty-panel p{margin:0}.empty-icon{font-size:30px;color:var(--accent-2)}.detail-header{display:flex;justify-content:space-between;gap:14px;padding-bottom:18px;border-bottom:1px solid var(--line)}.detail-header h2{font-size:22px;margin:4px 0 7px}.detail-header p{margin:0;color:var(--muted);font-size:13px;line-height:1.45}.badge{display:inline-flex;padding:4px 8px;border:1px solid #383842;border-radius:999px;color:#b9b9c4;font-size:10px}.issue-head{display:flex;justify-content:space-between;align-items:center;margin:20px 0 10px}.issue-head h3{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#a6a6b1}.issue-row{display:grid;grid-template-columns:72px 1fr 88px;gap:10px;padding:10px 4px;border-bottom:1px solid #24242b;font-size:12px}.issue-row .identifier{color:#8f8f9b}.issue-row .priority{text-align:right;color:#aaaab5}.ghost{margin-top:12px;width:100%;background:transparent;border:1px solid var(--line);color:#b7b7c2}.hidden{display:none!important}dialog{width:min(560px,calc(100vw - 40px));color:#e9e9ee;background:#19191f;border:1px solid #35353f;border-radius:15px;padding:0;box-shadow:0 24px 100px #000b}dialog::backdrop{background:#08080cbb;backdrop-filter:blur(3px)}dialog form{padding:24px;display:grid;gap:15px}.dialog-head{display:flex;justify-content:space-between}.dialog-head .close{font-size:20px}dialog label{font-size:12px;color:#b7b7c0;display:grid;gap:7px}dialog input,dialog textarea,dialog select{width:100%}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}.error{color:#f28989;font-size:12px;min-height:16px;margin:0}#toast{position:fixed;right:24px;bottom:24px;transform:translateY(20px);opacity:0;padding:11px 14px;border:1px solid #3b3b45;border-radius:9px;background:#25252d;box-shadow:0 12px 35px #0008;transition:.2s;pointer-events:none;font-size:12px}#toast.show{transform:none;opacity:1}@media(max-width:1100px){.workspace{grid-template-columns:390px 1fr}.metrics{grid-template-columns:repeat(3,1fr)}}"#;

pub(crate) const JS: &str = r#"const $=(s)=>document.querySelector(s);const state={projects:[],projectCursor:null,selected:null,catalog:{teams:[],projectStatuses:[],cycles:[]}};
const org=()=>$('#organization').value.trim();const headers=(json=false)=>{const h={};const token=$('#token').value.trim();if(token)h.Authorization=`Bearer ${token}`;if(json)h['Content-Type']='application/json';return h};
function query(values){const q=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')q.set(k,String(v))});return q.toString()}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{...headers(Boolean(options.body)),...(options.headers||{})}});if(!response.ok){let problem={};try{problem=await response.json()}catch{}throw new Error(problem.detail||`${response.status} ${response.statusText}`)}if(response.status===204)return null;return response.json()}
function escape(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
async function loadCatalog(){const base={organization_id:org(),limit:100};const [teams,statuses]=await Promise.all([api(`/api/projects/catalog/teams?${query(base)}`),api(`/api/projects/catalog/project-statuses?${query(base)}`)]);const firstTeam=teams.items?.[0]?.team_id;const cycles=firstTeam?await api(`/api/projects/catalog/cycles?${query({...base,team_id:firstTeam})}`):{items:[]};state.catalog={teams:teams.items||[],projectStatuses:statuses.items||[],cycles:cycles.items||[]};const teamSelect=$('[name=lead_team_id]');const statusSelect=$('[name=status_id]');teamSelect.innerHTML=state.catalog.teams.map(x=>`<option value="${escape(x.team_id)}">${escape(x.name||x.key||x.team_id)}</option>`).join('');statusSelect.innerHTML=state.catalog.projectStatuses.map(x=>`<option value="${escape(x.status_id)}">${escape(x.name||x.status_id)}</option>`).join('');$('#metric-cycle').textContent=state.catalog.cycles[0]?.name||'None'}
async function loadProjects(append=false){if(!org())throw new Error('Organization is required.');const params={organization_id:org(),include_archived:$('#show-archived').checked,limit:50,after:append?state.projectCursor:null};const data=await api(`/api/projects?${query(params)}`);state.projects=append?[...state.projects,...data.items]:data.items;state.projectCursor=data.next_cursor;renderProjects();$('#metric-projects').textContent=state.projects.filter(x=>!x.archived).length;$('#load-more-projects').classList.toggle('hidden',!state.projectCursor)}
function renderProjects(){const list=$('#projects-list');if(!state.projects.length){list.innerHTML='<div class="empty">No projects match this view.</div>';return}list.innerHTML=state.projects.map(p=>`<article class="project-card ${state.selected===p.project_id?'selected':''}" data-id="${escape(p.project_id)}"><span class="status-dot"></span><div><h3>${escape(p.name)}</h3><p>${escape(p.summary||'No summary')}</p></div><time>${escape(p.target_date||'—')}</time></article>`).join('');list.querySelectorAll('[data-id]').forEach(el=>el.addEventListener('click',()=>selectProject(el.dataset.id)))}
async function selectProject(id){state.selected=id;renderProjects();const project=await api(`/api/projects/${encodeURIComponent(id)}?${query({organization_id:org()})}`);const issues=await api(`/api/projects/${encodeURIComponent(id)}/issues?${query({organization_id:org(),include_archived:false,limit:50})}`);$('#metric-issues').textContent=issues.items.length;$('#project-detail').className='';$('#project-detail').innerHTML=`<div class="detail-header"><div><span class="badge">${escape(project.status_id)}</span><h2>${escape(project.name)}</h2><p>${escape(project.summary||'No summary')}</p></div><span class="badge">rev ${escape(project.revision)}</span></div><div class="issue-head"><h3>Issues</h3><span class="muted">${issues.items.length} shown</span></div><div>${issues.items.map(i=>`<div class="issue-row"><span class="identifier">${escape(i.identifier)}</span><strong>${escape(i.title)}</strong><span class="priority">${escape(i.priority)}</span></div>`).join('')||'<div class="empty">No issues yet.</div>'}</div>`}
async function connect(){try{$('#connection-state').textContent='Loading…';await Promise.all([loadCatalog(),loadProjects()]);$('#connection-state').textContent='Connected';toast('Workspace loaded')}catch(error){$('#connection-state').textContent='Connection failed';toast(error.message)}}
async function createProject(form){const values=Object.fromEntries(new FormData(form));const id=crypto.randomUUID();const body={idempotency_key:crypto.randomUUID(),organization_id:org(),project_id:id,name:values.name,summary:values.summary||null,lead_team_id:values.lead_team_id,team_ids:[values.lead_team_id],status_id:values.status_id,milestone_id:null,start_date:values.start_date||null,target_date:values.target_date||null};await api('/api/projects',{method:'POST',body:JSON.stringify(body)});$('#project-dialog').close();form.reset();await loadProjects();await selectProject(id);toast('Project created')}
$('#connect').addEventListener('click',connect);$('#refresh').addEventListener('click',connect);$('#show-archived').addEventListener('change',()=>loadProjects().catch(e=>toast(e.message)));$('#load-more-projects').addEventListener('click',()=>loadProjects(true).catch(e=>toast(e.message)));$('#new-project').addEventListener('click',()=>$('#project-dialog').showModal());document.querySelectorAll('.close').forEach(x=>x.addEventListener('click',()=>$('#project-dialog').close()));$('#project-form').addEventListener('submit',e=>{e.preventDefault();$('#form-error').textContent='';createProject(e.currentTarget).catch(error=>$('#form-error').textContent=error.message)});['organization','token'].forEach(id=>{const saved=localStorage.getItem(`lenso.projects.${id}`);if(saved)$(`#${id}`).value=saved;$(`#${id}`).addEventListener('change',e=>localStorage.setItem(`lenso.projects.${id}`,e.target.value))});"#;
