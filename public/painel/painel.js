// Painel Coqueria — gestão dos processos do analista (tarefas, Medição, Queda Zero, histórico e Excel).
// Usa o mesmo Firebase e o mesmo login do Dikma Gestão. Os dados de cada pessoa ficam em painel/{uid}/... e
// só ela lê e grava (ver firestore.rules). Funciona sem sinal: o Firestore guarda no aparelho e sincroniza depois.
import * as FBMOD from '../vendor/firebase.js';
window.__FBMOD = FBMOD;
window.__LOAD_XLSX = () => import('../vendor/xlsx.js').then(m => (m.utils ? m : m.default));

(function(){
/* ================= Ícones ================= */
const sv=(p,w=1.8)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I={
  home:sv('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  board:sv('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>'),
  cal:sv('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  med:sv('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  qz:sv('<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17h.01"/>'),
  hist:sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  proc:sv('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="4.5" cy="18" r="1.5"/>'),
  team:sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.5.2 4.3 1.9 5 4.9"/>'),
  more:sv('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',1.4),
  dl:sv('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',2),
  clock:sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',2),
  plus:sv('<path d="M12 5v14M5 12h14"/>',2.2),
  x:sv('<path d="M6 6l12 12M18 6 6 18"/>',2),
  check:sv('<path d="m5 12 5 5 9-10"/>',2.4),
  next:sv('<path d="M5 12h14M13 6l6 6-6 6"/>',2),
  chev:(d)=>sv(d==='l'?'<path d="M15 6l-6 6 6 6"/>':'<path d="M9 6l6 6-6 6"/>',2)
};

/* ================= Dados da planilha ================= */
const PEOPLE={
  henrique:{n:'Henrique',r:'Técnico Bateria',c:'arc'},
  camila:{n:'Camila',r:'Técnica Pátio de Carvão',c:'arc'},
  elieder:{n:'Elieder',r:'Técnico Pátio de Carvão',c:'arc'},
  patrick:{n:'Patrick',r:'Gerente Pátio de Carvão',c:'arc'},
  rafael:{n:'Rafael Martins',r:'Supervisor Pátio de Carvão',c:'arc'},
  jorge:{n:'Jorge',r:'Gerente',c:'dik'},
  djalnir:{n:'Djalnir',r:'Preposto',c:'dik'},
  wanderson:{n:'Wanderson',r:'Coordenador',c:'dik'},
  rodolfo:{n:'Rodolfo',r:'Faturamento',c:'dik'}
};
const AREAS={bat:'Bateria',pat:'Pátio de Carvão',ger:'Gestão geral'};
const PRIO={alta:'Alta',media:'Média',baixa:'Baixa'};
const STATUS=[['todo','A fazer'],['doing','Em andamento'],['review','Em revisão'],['done','Concluído']];
const STATUS_L=Object.fromEntries(STATUS);
const WD=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const PROCS=[
 {id:'P01',t:'Medição',a:'ger',p:'alta',freq:'Diariamente',prazo:'Mensal',
  d:['Conferir colaboradores presentes e lançar justificativas de faltas','Conferir e lançar horas extras realizadas','Lançar horas perdidas na operação de equipamentos (alinhado à Gestão Operacional)','Conferir e corrigir a medição ICCC e ICCP'],
  arc:['henrique','camila','elieder'],dik:['jorge','djalnir','wanderson','rodolfo']},
 {id:'P02',t:'Relatório fotográfico · Pátio de Carvão',a:'pat',p:'media',freq:'Diariamente',prazo:'Sexta-feira',wd:5,
  d:['Coletar registros fotográficos dos grupos de WhatsApp','Avaliar qualidade da imagem e limpeza','Montar a apresentação no PowerPoint','Enviar relatório ao cliente'],
  arc:['camila','elieder','patrick','rafael'],dik:['jorge','djalnir','wanderson']},
 {id:'P03',t:'Relatório fotográfico · Bateria',a:'bat',p:'media',freq:'Diariamente',prazo:'Segunda-feira',wd:1,
  d:['Coletar registros fotográficos dos grupos de WhatsApp','Avaliar qualidade da imagem e limpeza','Montar a apresentação no PowerPoint','Enviar relatório ao cliente'],
  arc:['henrique'],dik:['jorge','djalnir','wanderson']},
 {id:'P04',t:'Planejamento · Pátio de Carvão',a:'pat',p:'media',freq:'Diariamente',prazo:'Diariamente',daily:true,
  d:['Conferir com a liderança as atividades realizadas','Registrar atividades não realizadas e o motivo'],
  arc:['camila','elieder','patrick','rafael'],dik:['jorge','djalnir','wanderson']},
 {id:'P05',t:'Planejamento · Bateria',a:'bat',p:'media',freq:'Diariamente',prazo:'Diariamente',daily:true,
  d:['Conferir com a liderança as atividades realizadas','Registrar atividades não realizadas e o motivo'],
  arc:['henrique'],dik:['jorge','djalnir','wanderson']},
 {id:'P06',t:'Queda Zero',a:'pat',p:'media',freq:'Diariamente',prazo:'Terça-feira',wd:2,
  d:['Levantar com a liderança os registros de queda de material','Coletar registros fotográficos','Montar apresentação ao cliente para o plano de ação','Lançar registros do grupo Evoluir na planilha do Power BI'],
  arc:['camila','elieder'],dik:['jorge','djalnir','wanderson']},
 {id:'P07',t:'Gestão operacional',a:'ger',p:'alta',freq:'Diariamente',prazo:'Diariamente',daily:true,
  d:['Lançar equipamentos em operação ou em parada ao longo do dia','Inspeção de segurança, 5S e qualidade com os operadores','Lançar horas paradas na planilha de medição e no sistema de gestão'],
  arc:[],dik:['wanderson']},
 {id:'P08',t:'Gestão administrativa',a:'ger',p:'alta',freq:'Diariamente',prazo:'Diariamente',daily:true,
  d:['Revisar com o técnico de segurança pendências, padrões operacionais e ordens de serviço','Revisar com a liderança a documentação dos colaboradores','Inspeção de segurança e processo na área com os colaboradores'],
  arc:[],dik:['wanderson']},
 {id:'P09',t:'Ordens de manutenção',a:'ger',p:'baixa',freq:'Sob demanda',prazo:'Sob demanda',
  d:['Conferir as OMs com a liderança conforme as atividades solicitadas','Arquivar os documentos'],
  arc:[],dik:['wanderson']}
];
const PROC=Object.fromEntries(PROCS.map(p=>[p.id,p]));

const REG={
  falta:{l:'Faltas',one:'falta',who:'Colaborador',cat:'Tipo',cats:['Sem justificativa','Atestado médico','Justificada','Folga compensada','Afastamento'],desc:'Justificativa',hours:false},
  he:{l:'Horas extras',one:'hora extra',who:'Colaborador',cat:null,desc:'Motivo',hours:true},
  hp:{l:'Horas perdidas',one:'hora perdida',who:'Equipamento',cat:'Motivo',cats:['Manutenção corretiva','Manutenção preventiva','Falta de operador','Aguardando liberação','Condição climática','Outro'],desc:'Observação',hours:true},
  ind:{l:'ICCC / ICCP',one:'correção',who:null,cat:'Indicador',cats:['ICCC','ICCP'],desc:'Divergência encontrada',hours:false}
};
const QZ_MAT=['Carvão','Coque','Finos de coque','Outro'];
const QZ_ORIG=['Grupo Evoluir','Inspeção em campo','Liderança'];
const QZ_PLANO={sem:'Sem plano',andamento:'Plano em andamento',concluido:'Plano concluído'};

/* ================= Datas ================= */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d||1)};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const TODAY=(()=>{const d=new Date();d.setHours(0,0,0,0);return d})();
const TK=ymd(TODAY), TM=TK.slice(0,7);
const mondayOf=d=>{const w=d.getDay();return addD(d,w===0?-6:1-w)};
const isWeekend=d=>d.getDay()===0||d.getDay()===6;
const WORKDAY=isWeekend(TODAY)?addD(mondayOf(TODAY),7):TODAY;
const WEEK_MON=mondayOf(WORKDAY);
const lastBiz=d=>{let x=new Date(d.getFullYear(),d.getMonth()+1,0);while(isWeekend(x))x=addD(x,-1);return x};
const fmtShort=s=>{const d=parse(s);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`};
const fmtFull=s=>s?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:'';
const dayDiff=s=>Math.round((parse(s)-TODAY)/864e5);
const monthLabel=m=>{const [y,mm]=m.split('-').map(Number);return `${MONTHS[mm-1]} ${y}`};
const shiftMonth=(m,n)=>{const [y,mm]=m.split('-').map(Number);const d=new Date(y,mm-1+n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`};
const num=v=>{const n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:0};
const cDay=t=>t&&t.completedAt?ymd(new Date(t.completedAt)):null;
const fmtH=h=>(Math.round(h*10)/10).toLocaleString('pt-BR');

/* ================= Armazenamento (nuvem + cache local + fila offline) ================= */
const CK='painel-coqueria-v3';
const ST={tasks:{},registros:{},quedas:{},config:{}};
let QUEUE=[];
try{const c=JSON.parse(localStorage.getItem(CK));if(c&&c.st){for(const k in ST)if(c.st[k])ST[k]=c.st[k];QUEUE=Array.isArray(c.q)?c.q:[]}}catch(e){}
let THEME='system';try{THEME=localStorage.getItem(CK+'-theme')||'system'}catch(e){}
let FB=false; const fbPending={};
let db=null, mode='connecting', flushing=false, retryT=null, routineDone=false;
const synced={};
const clone=o=>JSON.parse(JSON.stringify(o));
let cacheT;function saveCache(){clearTimeout(cacheT);cacheT=setTimeout(()=>{try{localStorage.setItem(CK,JSON.stringify({st:ST,q:QUEUE}))}catch(e){}},120)}

function put(col,id,data){
  data=data?clone(data):null;
  if(data)ST[col][id]=data;else delete ST[col][id];
  if(mode==='local'){saveCache();return}
  QUEUE=QUEUE.filter(o=>!(o.col===col&&o.id===id));
  QUEUE.push({col,id,data});
  saveCache();refreshSync();flush();
}
async function flush(){
  if(!db||flushing||!QUEUE.length){refreshSync();return}
  flushing=true;refreshSync();
  while(QUEUE.length&&db){
    const op=QUEUE[0];
    try{
      const ref=db.doc(op.col+'/'+op.id);
      if(op.data)await ref.set(op.data);else await ref.delete();
      const i=QUEUE.indexOf(op);if(i>=0)QUEUE.splice(i,1);
      if(mode!=='online'){mode='online'}
      saveCache();
    }catch(e){
      const c=e&&e.code;
      if(c==='invalid_argument'||c==='transform_error'||c==='quota_exceeded'){
        const i=QUEUE.indexOf(op);if(i>=0)QUEUE.splice(i,1);saveCache();
        toast(c==='quota_exceeded'?'Armazenamento cheio. Exclua registros antigos para continuar salvando.':'Um item não pôde ser salvo e foi descartado.');continue;
      }
      if(c==='revoked'||c==='not_granted'||c==='capability_disabled'||c==='capability_removed'){db=null;mode='local';break}
      mode='offline';clearTimeout(retryT);retryT=setTimeout(flush,c==='resource_exhausted'?30000:12000);break;
    }
  }
  flushing=false;refreshSync();
}
function subscribe(col){
  try{
    db.collection(col).onSnapshot(snap=>{
      const m={};snap.docs.forEach(d=>{const v=d.data();if(v)m[d.id]=clone(v)});
      QUEUE.forEach(o=>{if(o.col===col){if(o.data)m[o.id]=o.data;else delete m[o.id]}});
      ST[col]=m;
      if(!snap.metadata.fromCache){synced[col]=true;if(mode==='connecting'||mode==='offline'&&!QUEUE.length)mode='online'}
      saveCache();maybeRoutine();scheduleRender();refreshSync();
    },err=>{mode='offline';refreshSync();setTimeout(()=>{if(db)subscribe(col)},20000)});
  }catch(e){mode='offline';refreshSync()}
}
function refreshSync(){
  const el=document.getElementById('sync');if(!el)return;
  let cls='',txt='';
  if(FB){const pend=Object.values(fbPending).some(Boolean);
    if(!navigator.onLine){cls='offline';txt='Sem conexão · salvo no aparelho'}else if(mode==='connecting'){cls='saving';txt='Conectando…'}else if(pend){cls='saving';txt='Salvando…'}else{cls='online';txt='Sincronizado'}
    el.className='sync '+cls;el.lastElementChild.textContent=txt;return}
  if(mode==='local'){cls='';txt='Salvo neste aparelho'}
  else if(mode==='connecting'){cls='saving';txt='Conectando…'}
  else if(QUEUE.length&&mode==='offline'){cls='offline';txt=`Sem conexão · ${QUEUE.length} pendente${QUEUE.length>1?'s':''}`}
  else if(mode==='offline'){cls='offline';txt='Sem conexão'}
  else if(QUEUE.length){cls='saving';txt='Salvando…'}
  else{cls='online';txt='Sincronizado'}
  el.className='sync '+cls;el.lastElementChild.textContent=txt;
}
window.addEventListener('online',()=>{if(db)flush();refreshSync()});
window.addEventListener('offline',()=>refreshSync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&db&&QUEUE.length)flush()});

/* ================= Rotina automática ================= */
const routineOn=()=>!(ST.config.main&&ST.config.main.autoRoutine===false);
const respOf=p=>[...p.dik.filter(x=>x==='wanderson'),...p.arc.slice(0,2)];
function mkTask(p,date,id,title){
  const k=ymd(date);
  return {id:id||`${p.id}_${k}`,pid:p.id,title:title||`${p.t} · ${fmtShort(k)}`,area:p.a,prio:p.p,due:k,status:'todo',resp:respOf(p),
    checklist:p.d.map(t=>({t,ok:false})),notes:'',createdAt:new Date().toISOString(),completedAt:null,routine:true};
}
function routineList(opts){
  const out=[];
  PROCS.forEach(p=>{
    if(p.daily)out.push(mkTask(p,WORKDAY));
    if(p.wd){const d=addD(WEEK_MON,p.wd-1);if(opts&&opts.week||ymd(d)>=TK)out.push(mkTask(p,d))}
  });
  const m=ymd(WORKDAY).slice(0,7);
  out.push(mkTask(PROC.P01,lastBiz(WORKDAY),'P01_'+m,`Medição de ${MONTHS[WORKDAY.getMonth()]} · fechamento`));
  return out;
}
function maybeRoutine(){
  if(routineDone)return;
  if(db&&!(synced.tasks&&synced.config))return;
  routineDone=true;
  if(!routineOn())return;
  let n=0;routineList().forEach(t=>{if(!ST.tasks[t.id]){put('tasks',t.id,t);n++}});
  if(n)toast(`Rotina de ${fmtShort(ymd(WORKDAY))} criada: ${n} tarefa${n>1?'s':''}`);
}
function genManual(week){
  let n=0;routineList({week}).forEach(t=>{const ex=ST.tasks[t.id];if(!ex||ex.deleted){put('tasks',t.id,t);n++}});
  toast(n?`${n} tarefa${n>1?'s':''} criada${n>1?'s':''}`:'A rotina já está no quadro');render(true);
}

/* ================= Estado de interface ================= */
let view='overview';
const VIEWS={overview:['Visão geral',I.home],board:['Quadro',I.board],agenda:['Agenda',I.cal],medicao:['Medição',I.med],queda:['Queda Zero',I.qz],historico:['Histórico',I.hist],process:['Processos',I.proc],team:['Equipe',I.team]};
try{const h=location.hash.slice(1);if(VIEWS[h])view=h}catch(e){}
let F={area:'all',prio:'all',person:'all',late:false};
let Q='';
let calStart=mondayOf(WORKDAY);
let medMonth=TM, medTab='falta', qzMonth='all';
let armed=null;

/* ================= Helpers ================= */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ini=n=>n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
const av=k=>{const p=PEOPLE[k];return p?`<span class="av ${p.c}" title="${esc(p.n)} · ${esc(p.r)}">${ini(p.n)}</span>`:''};
const tag=a=>`<span class="tag ${a}">${AREAS[a]||a}</span>`;
const prio=p=>`<span class="prio ${p}"><i></i>${PRIO[p]}</span>`;
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const tasks=()=>Object.values(ST.tasks).filter(t=>t&&!t.deleted&&t.due);
const isLate=t=>t.status!=='done'&&t.due<TK;
const quedas=()=>Object.values(ST.quedas).filter(q=>q&&q.data).sort((a,b)=>b.data.localeCompare(a.data));
const allRegs=()=>Object.values(ST.registros).filter(r=>r&&r.tipo&&r.data);
const regsOf=m=>allRegs().filter(r=>r.data.slice(0,7)===m);
function dueEl(t){
  const d=dayDiff(t.due);let cls='',txt=fmtShort(t.due);
  if(t.status!=='done'){if(d<0){cls='late';txt+=` · ${-d}d atraso`}else if(d===0){cls='soon';txt+=' · hoje'}else if(d===1){cls='soon';txt+=' · amanhã'}}
  return `<span class="due ${cls}">${I.clock}${txt}</span>`;
}
const progOf=t=>{const c=t.checklist||[];const n=c.length,k=c.filter(x=>x.ok).length;return {n,k,pct:n?Math.round(k/n*100):0}};
function matches(t){
  if(F.area!=='all'&&t.area!==F.area)return false;
  if(F.prio!=='all'&&t.prio!==F.prio)return false;
  if(F.person!=='all'&&!(t.resp||[]).includes(F.person))return false;
  if(F.late&&!isLate(t))return false;
  if(Q){const hay=(t.title+' '+(PROC[t.pid]?.t||'')+' '+(t.resp||[]).map(r=>PEOPLE[r]?.n).join(' ')+' '+AREAS[t.area]+' '+(t.notes||'')).toLowerCase();if(!hay.includes(Q))return false}
  return true;
}
function setStatus(t,s){
  const n=clone(t);const was=t.status;n.status=s;
  if(s==='done'){n.completedAt=n.completedAt||new Date().toISOString();if(was!=='done'){n.prevChecks=(n.checklist||[]).map(i=>!!i.ok);(n.checklist||[]).forEach(i=>i.ok=true)}}
  else{n.completedAt=null;if(was==='done'&&Array.isArray(n.prevChecks)){(n.checklist||[]).forEach((i,k)=>{if(k<n.prevChecks.length)i.ok=n.prevChecks[k]})}delete n.prevChecks}
  put('tasks',n.id,n);
}
function toast(m){document.querySelectorAll('.toast').forEach(e=>e.remove());const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=m;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)}
function barChart(data,color,h=150){
  const W=Math.max(320,data.length*44),pt=18,pb=22,ch=h-pt-pb;
  const max=Math.max(1,...data.map(d=>d.v));
  const step=Math.ceil(max/4)||1,top=step*4;
  const bw=(W-30)/data.length;
  let s=`<svg viewBox="0 0 ${W} ${h}" role="img">`;
  for(let i=0;i<=4;i++){const y=pt+ch-(i*step/top)*ch;s+=`<line class="gl" x1="26" x2="${W}" y1="${y}" y2="${y}"/><text x="20" y="${y+3}" text-anchor="end">${i*step}</text>`}
  data.forEach((d,i)=>{const bh=(d.v/top)*ch,x=30+i*bw+bw*.18,w=bw*.64,y=pt+ch-bh;
    s+=`<rect x="${x}" y="${y}" width="${w}" height="${Math.max(bh,0)}" rx="3" fill="var(--${d.hl?'accent':color})" opacity="${d.hl?1:.85}"><title>${esc(d.l)}: ${d.v}</title></rect>`;
    if(d.v)s+=`<text class="val" x="${x+w/2}" y="${y-4}" text-anchor="middle">${fmtH(d.v)}</text>`;
    s+=`<text x="${x+w/2}" y="${h-6}" text-anchor="middle">${esc(d.l)}</text>`});
  return s+'</svg>';
}

/* ================= Navegação ================= */
function counts(){
  const T=tasks();
  return {board:T.filter(t=>t.status!=='done').length,late:T.filter(isLate).length,
    medicao:regsOf(TM).filter(r=>r.tipo==='ind'?r.status!=='corrigido':!r.lancado).length,
    queda:quedas().filter(q=>!q.powerbi).length};
}
function renderNav(){
  const c=counts();
  const item=k=>{const [l,ic]=VIEWS[k];let n='';
    if(k==='board')n=`<span class="count ${c.late?'alert':''}">${c.late?c.late+' atr.':c.board}</span>`;
    if(k==='medicao'&&c.medicao)n=`<span class="count">${c.medicao}</span>`;
    if(k==='queda'&&c.queda)n=`<span class="count">${c.queda}</span>`;
    return `<button data-v="${k}" ${view===k?'aria-current="page"':''}>${ic}${l}${n}</button>`};
  document.getElementById('nav').innerHTML=item('overview')+item('board')+item('agenda')+'<div class="grp">Lançamentos</div>'+item('medicao')+item('queda')+item('historico')+'<div class="grp">Cadastro</div>'+item('process')+item('team');
  const mob=['overview','board','medicao','queda'];
  document.getElementById('mobNav').innerHTML=mob.map(k=>`<button data-v="${k}" ${view===k?'aria-current="page"':''}>${VIEWS[k][1]}${VIEWS[k][0].split(' ')[0]}</button>`).join('')+`<button id="moreBtn" ${!mob.includes(view)?'aria-current="page"':''}>${I.more}Mais</button>`;
  document.getElementById('sheetIn').innerHTML=['agenda','historico','process','team'].map(k=>`<button data-v="${k}">${VIEWS[k][1]}${VIEWS[k][0]}</button>`).join('')+`<button id="exportM" style="grid-column:1/-1">${I.dl}Exportar Excel</button>`;
  document.getElementById('pageTitle').textContent=VIEWS[view][0];
}
document.addEventListener('click',e=>{
  const sh=document.getElementById('sheet');
  if(e.target.closest('#moreBtn')){sh.classList.add('open');return}
  if(e.target.closest('#exportM')){sh.classList.remove('open');openExport();return}
  if(e.target===sh){sh.classList.remove('open');return}
  const b=e.target.closest('[data-v]');
  if(b){sh.classList.remove('open');view=b.dataset.v;armed=null;render(true);document.getElementById('content').scrollTop=0}
});

/* ================= Visão geral ================= */
function vOverview(){
  const T=tasks();
  const open=T.filter(t=>t.status!=='done');
  const late=T.filter(isLate);
  const wkStart=ymd(WEEK_MON),wkEnd=ymd(addD(WEEK_MON,6));
  const wk=T.filter(t=>t.due>=wkStart&&t.due<=wkEnd);
  const wkDone=wk.filter(t=>t.status==='done').length;
  const pct=wk.length?Math.round(wkDone/wk.length*100):0;
  const byS=STATUS.map(([k,l])=>[k,l,open.filter(t=>t.status===k).length+(k==='done'?wkDone:0)]);
  const total=byS.reduce((a,b)=>a+b[2],0)||1;
  const days=[0,1,2,3,4].map(i=>addD(WEEK_MON,i));
  const wdk=ymd(WORKDAY);
  const routine=T.filter(t=>t.due===wdk||(isLate(t)&&t.routine)).sort((a,b)=>(a.status==='done')-(b.status==='done')||a.due.localeCompare(b.due));
  const areaRows=Object.keys(AREAS).map(a=>[a,open.filter(t=>t.area===a).length]);
  const maxA=Math.max(1,...areaRows.map(r=>r[1]));
  const regs=regsOf(TM);
  const pf=regs.filter(r=>r.tipo==='falta'&&!r.lancado).length,ph=regs.filter(r=>r.tipo==='he'&&!r.lancado).length,pp=regs.filter(r=>r.tipo==='hp'&&!r.lancado).length,pi=regs.filter(r=>r.tipo==='ind'&&r.status!=='corrigido').length;
  const Qs=quedas();const pbi=Qs.filter(q=>!q.powerbi).length;
  const pastQ=Qs.filter(q=>q.data<=TK);const dsq=pastQ.length?Math.round((TODAY-parse(pastQ[0].data))/864e5):null;
  const routineLabel=wdk===TK?'Rotina de hoje':`Rotina de ${WD[WORKDAY.getDay()].toLowerCase()}, ${fmtShort(wdk)}`;
  return `
  <div class="kpis">
    <button class="kpi" data-goto="open"><span class="eyebrow">Em aberto</span><span class="v">${open.length}</span><span class="h">${open.filter(t=>t.status==='doing').length} em andamento · ${open.filter(t=>t.status==='review').length} em revisão</span></button>
    <div class="kpi ok"><span class="eyebrow">Semana concluída</span><span class="v">${pct}%</span><div class="meter"><i style="width:${pct}%"></i></div><span class="h">${wkDone} de ${wk.length} entregas · ${fmtShort(wkStart)} a ${fmtShort(ymd(addD(WEEK_MON,4)))}</span></div>
    <button class="kpi ${late.length?'crit':''}" data-goto="late"><span class="eyebrow">Atrasadas</span><span class="v">${late.length}</span><span class="h">${late.length?esc(late.sort((a,b)=>a.due.localeCompare(b.due))[0].title):'Nenhuma pendência vencida'}</span></button>
    <button class="kpi ${dsq===0?'crit':'ok'}" data-v="queda"><span class="eyebrow">Dias sem queda</span><span class="v">${dsq==null?'—':dsq}</span><span class="h">${pastQ.length?`Última: ${fmtFull(pastQ[0].data)}`:'Nenhuma ocorrência registrada'}</span></button>
  </div>
  <div class="grid ov" style="margin-top:16px">
    <div class="grid" style="align-content:start">
      <section class="panel">
        <h2>Entregas da semana <span class="sub mono">${fmtShort(wkStart)} – ${fmtShort(ymd(addD(WEEK_MON,4)))}</span></h2>
        <div class="stack" role="img" aria-label="Distribuição por status">${byS.map(([k,,n])=>n?`<i class="s-${k}" style="width:${n/total*100}%"></i>`:'').join('')}</div>
        <div class="legend">${byS.map(([k,l,n])=>`<span><i class="dot s-${k}"></i>${l} <b class="mono">${n}</b></span>`).join('')}</div>
        <div class="week">${days.map(d=>{const k=ymd(d);const its=T.filter(t=>t.due===k);
          return `<div class="day ${k===TK?'today':''}"><div class="dh"><b>${WD[d.getDay()].slice(0,3)}</b><span>${fmtShort(k)}</span></div>
          ${its.map(t=>`<button class="chip ${t.status==='done'?'is-done':''}" data-open="${t.id}" title="${esc(t.title)}"><i class="dot s-${t.status}"></i><span>${esc((PROC[t.pid]?.t||t.title).split(' · ')[0])}${PROC[t.pid]?.t.includes(' · ')?' '+(t.area==='bat'?'Bat.':'Pátio'):''}</span></button>`).join('')||'<span class="code">Sem entregas</span>'}</div>`}).join('')}</div>
      </section>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <section class="panel">
          <h2>Pendências de lançamento <span class="sub">${MONTHS[TODAY.getMonth()]}</span></h2>
          <div class="pend">
            <button data-medtab="falta"><span>Faltas sem lançar<small>Medição · justificativas</small></span><span class="n ${pf?'hot':''}">${pf}</span></button>
            <button data-medtab="he"><span>Horas extras sem lançar<small>Medição</small></span><span class="n ${ph?'hot':''}">${ph}</span></button>
            <button data-medtab="hp"><span>Horas perdidas sem lançar<small>Medição · equipamentos</small></span><span class="n ${pp?'hot':''}">${pp}</span></button>
            <button data-medtab="ind"><span>Correções ICCC/ICCP pendentes<small>Medição</small></span><span class="n ${pi?'hot':''}">${pi}</span></button>
            <button data-v="queda"><span>Quedas fora do Power BI<small>Queda Zero · grupo Evoluir</small></span><span class="n ${pbi?'hot':''}">${pbi}</span></button>
          </div>
        </section>
        <section class="panel">
          <h2>Carga por área <span class="sub">tarefas em aberto</span></h2>
          <div class="bars">${areaRows.map(([a,n])=>`<div class="bar-row"><span>${AREAS[a]}</span><div class="bar-track"><i style="width:${n/maxA*100}%;background:var(--${a})"></i></div><span class="n">${n}</span></div>`).join('')}</div>
        </section>
      </div>
    </div>
    <section class="panel" style="align-self:start">
      <h2>${routineLabel} <span class="sub">${routine.filter(t=>t.status==='done').length}/${routine.length}</span></h2>
      <div class="routine">${routine.map(t=>{const p=progOf(t);return `<label class="${t.status==='done'?'done':''}"><input type="checkbox" data-quick="${t.id}" ${t.status==='done'?'checked':''}><span><span class="t">${esc(t.title)}</span><br><span class="m">${isLate(t)?'<b style="color:var(--crit)">Atrasada</b> · ':''}${AREAS[t.area]} · checklist ${p.k}/${p.n}</span></span>${prio(t.prio)}</label>`}).join('')||'<span class="code">Nada programado para este dia.</span>'}</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="genRoutine">${I.plus}Gerar rotina do dia</button><button class="btn ghost" data-v="board">Abrir quadro</button></div>
    </section>
  </div>`;
}

/* ================= Quadro ================= */
function vBoard(){
  const T=tasks().filter(matches);
  const order={alta:0,media:1,baixa:2};
  const any=F.area!=='all'||F.prio!=='all'||F.person!=='all'||F.late||Q;
  const hidePast=!any;
  return `
  <div class="filters">
    <div class="seg" role="group" aria-label="Área">${[['all','Todas'],...Object.entries(AREAS)].map(([k,l])=>`<button data-fa="${k}" aria-pressed="${F.area===k}">${l}</button>`).join('')}</div>
    <select class="sel" id="fPrio" aria-label="Prioridade"><option value="all">Toda prioridade</option>${Object.entries(PRIO).map(([k,l])=>`<option value="${k}" ${F.prio===k?'selected':''}>${l}</option>`).join('')}</select>
    <select class="sel" id="fPerson" aria-label="Responsável"><option value="all">Todos os responsáveis</option>${Object.entries(PEOPLE).map(([k,p])=>`<option value="${k}" ${F.person===k?'selected':''}>${esc(p.n)} (${p.c==='dik'?'Dikma':'Arcelor'})</option>`).join('')}</select>
    <button class="btn sm ${F.late?'primary':''}" id="fLate">Só atrasadas</button>
    ${any?'<button class="btn ghost sm" id="clearF">Limpar filtros</button>':''}
  </div>
  <div class="board-wrap"><div class="board">
  ${STATUS.map(([k,l],si)=>{let its=T.filter(t=>t.status===k);
    let hidden=0;if(k==='done'&&hidePast){const lim=ymd(addD(TODAY,-7));const all=its.length;its=its.filter(t=>(cDay(t)||t.due)>=lim);hidden=all-its.length}
    its.sort((a,b)=>k==='done'?(b.completedAt||'').localeCompare(a.completedAt||''):(a.due.localeCompare(b.due)||order[a.prio]-order[b.prio]));
    return `<section class="col" data-col="${k}"><div class="col-h"><i class="dot s-${k}"></i><b>${l}</b><span class="n">${its.length}</span><button class="add" data-addcol="${k}" aria-label="Adicionar em ${l}">${I.plus}</button></div>
    <div class="col-body">${its.map(t=>card(t,si)).join('')||`<div class="empty-col">${tasks().length?'Arraste um cartão para cá':'Nenhuma tarefa ainda'}</div>`}${hidden?`<div class="code" style="text-align:center;padding:6px">${hidden} concluída${hidden>1?'s':''} há mais de 7 dias · veja no Histórico</div>`:''}</div></section>`}).join('')}
  </div></div>`;
}
function card(t,si){
  const p=progOf(t);const pr=PROC[t.pid];
  const nxt=STATUS[si+1];
  return `<article class="card" draggable="true" data-id="${t.id}" tabindex="0" role="button" aria-label="${esc(t.title)}">
    <div class="row">${tag(t.area)}${prio(t.prio)}<span class="code" style="margin-left:auto">${pr?pr.id:'AVULSA'}</span></div>
    <div class="ttl">${esc(t.title)}</div>
    ${p.n?`<div class="prog"><div class="meter"><i style="width:${p.pct}%"></i></div>${p.k}/${p.n}</div>`:''}
    <div class="foot">${dueEl(t)}<div class="avs">${(t.resp||[]).slice(0,3).map(av).join('')}</div>${nxt?`<button class="mv" data-mv="${t.id}" data-to="${nxt[0]}" title="Mover para ${nxt[1]}" aria-label="Mover para ${nxt[1]}">${nxt[0]==='done'?I.check:I.next}</button>`:''}</div>
  </article>`;
}

/* ================= Agenda ================= */
function vAgenda(){
  const days=[...Array(7)].map((_,i)=>addD(calStart,i));
  const end=days[6];
  const lbl=calStart.getMonth()===end.getMonth()?`${calStart.getDate()} – ${end.getDate()} de ${MONTHS[end.getMonth()]}`:`${calStart.getDate()} ${MONTHS[calStart.getMonth()].slice(0,3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0,3)}`;
  return `<div class="cal-h"><b>${lbl}</b>
    <button class="btn sm" id="calPrev" aria-label="Semana anterior">${I.chev('l')}</button>
    <button class="btn sm" id="calToday">Esta semana</button>
    <button class="btn sm" id="calNext" aria-label="Próxima semana">${I.chev('r')}</button></div>
  <div class="cal-wrap"><div class="cal">${days.map(d=>{const k=ymd(d);const its=tasks().filter(t=>t.due===k&&matches(t));
    const fixed=PROCS.filter(p=>p.wd===d.getDay());const qz=quedas().filter(q=>q.data===k).length;
    return `<div class="day ${k===TK?'today':''} ${isWeekend(d)?'wk':''}"><div class="dh"><b>${WD[d.getDay()]}</b><span>${fmtShort(k)}</span></div>
      ${fixed.length?`<div class="code">Prazo fixo: ${fixed.map(p=>p.id).join(', ')}</div>`:''}
      ${qz?`<div class="pill crit" style="align-self:flex-start">${qz} queda${qz>1?'s':''}</div>`:''}
      ${its.map(t=>`<button class="chip ${t.status==='done'?'is-done':''}" data-open="${t.id}"><span style="display:flex;gap:6px;align-items:center"><i class="dot s-${t.status}"></i>${tag(t.area)}</span><span>${esc(t.title)}</span></button>`).join('')}
      <button class="chip" data-addday="${k}" style="justify-content:center;color:var(--ink-3);border-style:dashed">${I.plus}<span>Adicionar</span></button>
    </div>`}).join('')}</div></div>`;
}

/* ================= Medição ================= */
function knownNames(tipo){
  const key=tipo==='hp'?'hp':'pessoa';
  const s=new Set();allRegs().forEach(r=>{if(r.quem&&((key==='hp'&&r.tipo==='hp')||(key==='pessoa'&&(r.tipo==='falta'||r.tipo==='he'))))s.add(r.quem)});
  return [...s].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function vMedicao(){
  const items=regsOf(medMonth);
  const by=t=>items.filter(r=>r.tipo===t);
  const F_=by('falta'),HE=by('he'),HP=by('hp'),IND=by('ind');
  const sumH=a=>a.reduce((s,r)=>s+num(r.horas),0);
  const R=REG[medTab];
  const list=by(medTab).filter(r=>!Q||((r.quem||'')+' '+(r.desc||'')+' '+(r.cat||'')).toLowerCase().includes(Q)).sort((a,b)=>b.data.localeCompare(a.data)||(b.ts||0)-(a.ts||0));
  const defDate=medMonth===TM?TK:medMonth+'-01';
  const names=knownNames(medTab);
  return `
  <div class="mhead"><button class="btn sm" id="mPrev" aria-label="Mês anterior">${I.chev('l')}</button><b>${monthLabel(medMonth)}</b><button class="btn sm" id="mNext" aria-label="Próximo mês">${I.chev('r')}</button>${medMonth!==TM?'<button class="btn ghost sm" id="mNow">Mês atual</button>':''}<span style="flex:1"></span><button class="btn sm" data-export="${medMonth}">${I.dl}Exportar mês</button></div>
  <div class="kpis">
    <button class="kpi ${F_.some(r=>!r.lancado)?'warn':''}" data-medtab="falta"><span class="eyebrow">Faltas</span><span class="v">${F_.length}</span><span class="h">${F_.filter(r=>!r.lancado).length} sem lançar · ${F_.filter(r=>r.cat==='Sem justificativa').length} sem justificativa</span></button>
    <button class="kpi" data-medtab="he"><span class="eyebrow">Horas extras</span><span class="v">${fmtH(sumH(HE))}<small>h</small></span><span class="h">${HE.length} lançamento${HE.length!==1?'s':''} · ${HE.filter(r=>!r.lancado).length} sem lançar</span></button>
    <button class="kpi" data-medtab="hp"><span class="eyebrow">Horas perdidas</span><span class="v">${fmtH(sumH(HP))}<small>h</small></span><span class="h">${new Set(HP.map(r=>r.quem)).size} equipamento${new Set(HP.map(r=>r.quem)).size!==1?'s':''} · ${HP.filter(r=>!r.lancado).length} sem lançar</span></button>
    <button class="kpi ${IND.some(r=>r.status!=='corrigido')?'crit':''}" data-medtab="ind"><span class="eyebrow">ICCC / ICCP</span><span class="v">${IND.filter(r=>r.status!=='corrigido').length}</span><span class="h">pendentes · ${IND.filter(r=>r.status==='corrigido').length} corrigidas</span></button>
  </div>
  <div class="tabs" role="tablist">${Object.entries(REG).map(([k,r])=>`<button role="tab" data-medtab="${k}" aria-selected="${medTab===k}">${r.l}<span class="n">${by(k).length}</span></button>`).join('')}</div>
  <form class="qform" id="regForm" autocomplete="off">
    <div class="f"><label for="r_data">Data</label><input type="date" id="r_data" value="${defDate}" required></div>
    ${R.who?`<div class="f"><label for="r_quem">${R.who}</label><input id="r_quem" list="r_names" placeholder="${medTab==='hp'?'Ex.: Pá carregadeira 03':'Nome do colaborador'}" required><datalist id="r_names">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>`:''}
    ${medTab!=='ind'?`<div class="f"><label for="r_area">Área</label><select id="r_area">${Object.entries(AREAS).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></div>`:''}
    ${R.cat?`<div class="f"><label for="r_cat">${R.cat}</label><select id="r_cat">${R.cats.map(c=>`<option>${c}</option>`).join('')}</select></div>`:''}
    ${R.hours?`<div class="f"><label for="r_horas">Horas</label><input type="number" id="r_horas" min="0" step="0.25" inputmode="decimal" placeholder="0,0" required></div>`:''}
    <div class="f ${medTab==='ind'?'wide':''}"><label for="r_desc">${R.desc}</label><input id="r_desc" placeholder="${medTab==='ind'?'O que estava errado na medição':'Opcional'}" ${medTab==='ind'?'required':''}></div>
    <button class="btn primary" type="submit">${I.plus}Registrar</button>
  </form>
  ${list.length?`<div class="recs">
    <div class="rec head r-${medTab}"><span>Data</span>${medTab==='ind'?'<span>Indicador</span><span>Divergência</span>':`<span>${R.who}</span><span>${medTab==='falta'?'Tipo · justificativa':R.desc}</span><span>${R.hours?'Horas':''}</span>`}<span style="text-align:right">Situação</span></div>
    ${list.map(r=>recRow(r)).join('')}
  </div>`:`<div class="empty"><b>Nenhum registro de ${R.l.toLowerCase()} em ${monthLabel(medMonth)}</b><span>Use o formulário acima. Cada registro fica marcado como “a lançar” até você confirmar o lançamento no sistema.</span></div>`}
  ${list.length&&R.hours?`<div class="code" style="margin-top:8px;text-align:right">Total: ${fmtH(list.reduce((s,r)=>s+num(r.horas),0))} h</div>`:''}`;
}
function recRow(r){
  const del=`<button class="del ${armed===r.id?'arm':''}" data-rdel="${r.id}">${armed===r.id?'Confirmar exclusão':'Excluir'}</button>`;
  if(r.tipo==='ind')return `<div class="rec r-ind"><span class="c-date mono">${fmtShort(r.data)}</span><span class="main-t">${esc(r.cat)}</span><span class="sub-t" style="color:var(--ink)">${esc(r.desc)}</span><span class="acts"><button class="tog" data-rtog="${r.id}" aria-pressed="${r.status==='corrigido'}">${r.status==='corrigido'?I.check+'Corrigido':'Pendente'}</button>${del}</span></div>`;
  return `<div class="rec r-${r.tipo}"><span class="c-date mono">${fmtShort(r.data)}</span>
    <span><span class="main-t">${esc(r.quem)}</span><br><span class="sub-t">${AREAS[r.area]||''}</span></span>
    <span class="sub-t" style="color:var(--ink-2)">${r.tipo!=='he'&&r.cat?`<b>${esc(r.cat)}</b>${r.desc?' · ':''}`:''}${esc(r.desc||'')}</span>
    <span class="mono">${r.tipo==='falta'?'':fmtH(num(r.horas))+' h'}</span>
    <span class="acts"><button class="tog" data-rtog="${r.id}" aria-pressed="${!!r.lancado}">${r.lancado?I.check+'Lançado':'A lançar'}</button>${del}</span></div>`;
}


/* ================= Queda Zero ================= */
function vQueda(){
  const all=quedas();
  const past=all.filter(q=>q.data<=TK);
  const dsq=past.length?Math.round((TODAY-parse(past[0].data))/864e5):null;
  const mon=all.filter(q=>q.data.slice(0,7)===TM);
  const weeks=[...Array(8)].map((_,i)=>addD(mondayOf(TODAY),-7*(7-i)));
  const wdata=weeks.map(w=>{const a=ymd(w),b=ymd(addD(w,6));return {l:fmtShort(a),v:all.filter(q=>q.data>=a&&q.data<=b).length,hl:a===ymd(mondayOf(TODAY))}});
  const months=[...new Set(all.map(q=>q.data.slice(0,7)))].sort().reverse();
  let list=qzMonth==='all'?all:all.filter(q=>q.data.slice(0,7)===qzMonth);
  if(Q)list=list.filter(q=>((q.local||'')+' '+(q.desc||'')+' '+(q.material||'')+' '+(q.acao||'')).toLowerCase().includes(Q));
  return `
  <div class="qz-top">
    <div class="counter"><span class="eyebrow">Dias sem queda de material</span><span class="big ${dsq===0?'zero':''}">${dsq==null?'—':dsq}</span><span class="lb">${dsq==null?'Nenhuma ocorrência registrada':`Última ocorrência em ${fmtFull(past[0].data)}`}</span>${dsq!=null&&past[0].local?`<span class="code">${esc(past[0].local)}</span>`:''}</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
      <div class="kpi"><span class="eyebrow">No mês</span><span class="v">${mon.length}</span><span class="h">ocorrências em ${MONTHS[TODAY.getMonth()]}</span></div>
      <div class="kpi ${all.some(q=>!q.powerbi)?'warn':''}"><span class="eyebrow">Fora do Power BI</span><span class="v">${all.filter(q=>!q.powerbi).length}</span><span class="h">a lançar na planilha</span></div>
      <div class="kpi"><span class="eyebrow">Planos abertos</span><span class="v">${all.filter(q=>q.plano!=='concluido').length}</span><span class="h">${all.filter(q=>q.plano==='sem').length} sem plano de ação</span></div>
      <div class="kpi"><span class="eyebrow">A apresentar</span><span class="v">${all.filter(q=>!q.apresentado).length}</span><span class="h">ao cliente (terça)</span></div>
    </div>
  </div>
  <section class="panel chart" style="margin-top:16px"><h2>Ocorrências por semana <span class="sub">últimas 8 semanas</span></h2>${barChart(wdata,'pat',140)}</section>
  <div class="filters" style="margin-top:16px">
    <select class="sel" id="qzMonth" aria-label="Mês"><option value="all">Todos os meses</option>${months.map(m=>`<option value="${m}" ${qzMonth===m?'selected':''}>${monthLabel(m)}</option>`).join('')}</select>
    <span class="code">${list.length} ocorrência${list.length!==1?'s':''}</span><span style="flex:1"></span>
    <button class="btn primary" id="qzNew">${I.plus}Registrar queda</button>
  </div>
  ${list.length?`<div class="qcards">${list.map(q=>`<article class="panel qcard" data-qz="${q.id}" tabindex="0" role="button">
    <div class="row"><span class="mono" style="font-weight:500">${fmtFull(q.data)}</span>${tag(q.area)}<span class="pill ${q.plano==='concluido'?'ok':q.plano==='andamento'?'warn':'crit'}" style="margin-left:auto">${QZ_PLANO[q.plano]||'Sem plano'}</span></div>
    <div class="ttl">${esc(q.local||'Local não informado')} · ${esc(q.material||'')}${q.qtd?` · ${esc(q.qtd)}`:''}</div>
    ${q.desc?`<div class="desc">${esc(q.desc)}</div>`:''}
    <div class="row"><span class="pill ${q.powerbi?'ok':''}">${q.powerbi?'No Power BI':'Fora do Power BI'}</span><span class="pill ${q.apresentado?'ok':''}">${q.apresentado?'Apresentada':'Não apresentada'}</span><span class="code" style="margin-left:auto">${esc(q.origem||'')}</span></div>
  </article>`).join('')}</div>`:`<div class="empty"><b>Nenhuma queda registrada${qzMonth!=='all'?' neste mês':''}</b><span>Registre as ocorrências do grupo Evoluir e das inspeções. O contador de dias sem queda e o gráfico se atualizam sozinhos.</span><button class="btn primary" id="qzNew2">${I.plus}Registrar queda</button></div>`}`;
}
let qEdit=null, qConfirm=false;
function openQueda(id){
  qConfirm=false;
  qEdit=id?clone(ST.quedas[id]):{id:'q'+nid(),data:TK,area:'pat',local:'',material:'Carvão',qtd:'',origem:'Grupo Evoluir',desc:'',plano:'sem',acao:'',powerbi:false,apresentado:false,_new:true};
  renderQueda();
}
function renderQueda(){
  const r=document.getElementById('modalRoot');const q=qEdit;
  if(!q){r.innerHTML='';return}
  r.innerHTML=`<div class="overlay" id="ov"><form class="modal" id="qzForm" role="dialog" aria-modal="true" aria-label="Ocorrência de queda">
    <div class="modal-h"><h3>${q._new?'Registrar queda de material':'Ocorrência de queda'}</h3><button type="button" class="x" id="mClose" aria-label="Fechar">${I.x}</button></div>
    <div class="modal-b one">
      <div class="fld"><label for="q_data">Data</label><input type="date" id="q_data" value="${q.data}" max="${TK}" required></div>
      <div class="fld"><label for="q_area">Área</label><select id="q_area">${['pat','bat'].map(k=>`<option value="${k}" ${q.area===k?'selected':''}>${AREAS[k]}</option>`).join('')}</select></div>
      <div class="fld span"><label for="q_local">Local</label><input type="text" id="q_local" value="${esc(q.local)}" placeholder="Ex.: Correia transportadora TC-03, pátio 2" list="q_locs"><datalist id="q_locs">${[...new Set(quedas().map(x=>x.local).filter(Boolean))].map(l=>`<option value="${esc(l)}">`).join('')}</datalist></div>
      <div class="fld"><label for="q_mat">Material</label><select id="q_mat">${QZ_MAT.map(m=>`<option ${q.material===m?'selected':''}>${m}</option>`).join('')}</select></div>
      <div class="fld"><label for="q_qtd">Quantidade estimada</label><input type="text" id="q_qtd" value="${esc(q.qtd)}" placeholder="Ex.: 50 kg"></div>
      <div class="fld"><label for="q_orig">Origem do registro</label><select id="q_orig">${QZ_ORIG.map(m=>`<option ${q.origem===m?'selected':''}>${m}</option>`).join('')}</select></div>
      <div class="fld"><label for="q_plano">Plano de ação</label><select id="q_plano">${Object.entries(QZ_PLANO).map(([k,l])=>`<option value="${k}" ${q.plano===k?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="fld span"><label for="q_desc">Descrição</label><textarea id="q_desc" placeholder="O que aconteceu e o que foi verificado com a liderança">${esc(q.desc)}</textarea></div>
      <div class="fld span"><label for="q_acao">Ação definida com o cliente</label><input type="text" id="q_acao" value="${esc(q.acao)}" placeholder="Ex.: instalar raspador na TC-03 até 30/10"></div>
      <div class="fld span checks"><label><input type="checkbox" id="q_pbi" ${q.powerbi?'checked':''}>Lançada na planilha do Power BI</label><label><input type="checkbox" id="q_apr" ${q.apresentado?'checked':''}>Apresentada ao cliente</label></div>
    </div>
    <div class="modal-f">
      ${q._new?'':(qConfirm?`<span class="confirm">Excluir esta ocorrência?</span><button type="button" class="btn danger" id="qDelYes">Excluir</button><button type="button" class="btn ghost" id="qDelNo">Manter</button>`:`<button type="button" class="btn danger" id="qDel">Excluir</button>`)}
      <span class="grow"></span><button type="button" class="btn" id="mCancel">Cancelar</button><button type="submit" class="btn primary">${q._new?'Registrar':'Salvar'}</button>
    </div></form></div>`;
  const $=id=>document.getElementById(id);
  const close=()=>{qEdit=null;renderQueda()};
  $('mClose').onclick=close;$('mCancel').onclick=close;
  $('ov').addEventListener('mousedown',e=>{if(e.target.id==='ov')close()});
  const sync=()=>Object.assign(q,{data:$('q_data').value||q.data,area:$('q_area').value,local:$('q_local').value.trim(),material:$('q_mat').value,qtd:$('q_qtd').value.trim(),origem:$('q_orig').value,plano:$('q_plano').value,desc:$('q_desc').value.trim(),acao:$('q_acao').value.trim(),powerbi:$('q_pbi').checked,apresentado:$('q_apr').checked});
  if($('qDel'))$('qDel').onclick=()=>{sync();qConfirm=true;renderQueda()};
  if($('qDelNo'))$('qDelNo').onclick=()=>{sync();qConfirm=false;renderQueda()};
  if($('qDelYes'))$('qDelYes').onclick=()=>{put('quedas',q.id,null);qEdit=null;renderQueda();render();toast('Ocorrência excluída')};
  $('qzForm').onsubmit=e=>{e.preventDefault();sync();const isNew=q._new;delete q._new;q.ts=q.ts||Date.now();put('quedas',q.id,q);qEdit=null;renderQueda();render();toast(isNew?'Queda registrada':'Alterações salvas')};
}

/* ================= Histórico ================= */
function monthStats(m){
  const T=tasks();
  const done=T.filter(t=>t.status==='done'&&(cDay(t)||t.due).slice(0,7)===m);
  const dueIn=T.filter(t=>t.due.slice(0,7)===m);
  const onTime=done.filter(t=>!t.completedAt||cDay(t)<=t.due).length;
  const R=regsOf(m);
  const sumH=tp=>R.filter(r=>r.tipo===tp).reduce((s,r)=>s+num(r.horas),0);
  return {m,done:done.length,due:dueIn.length,dueDone:dueIn.filter(t=>t.status==='done').length,onTime:done.length?Math.round(onTime/done.length*100):null,
    faltas:R.filter(r=>r.tipo==='falta').length,he:sumH('he'),hp:sumH('hp'),ind:R.filter(r=>r.tipo==='ind').length,
    quedas:quedas().filter(q=>q.data.slice(0,7)===m).length};
}
function vHistorico(){
  const ms=[...Array(12)].map((_,i)=>shiftMonth(TM,-11+i));
  const S=ms.map(monthStats);
  const lbl=m=>MONTHS[+m.slice(5,7)-1].slice(0,3);
  const has=S.some(s=>s.done||s.faltas||s.he||s.hp||s.quedas);
  return `
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <section class="panel chart"><h2>Tarefas concluídas <span class="sub">por mês</span></h2>${barChart(S.map(s=>({l:lbl(s.m),v:s.done,hl:s.m===TM})),'ok')}</section>
    <section class="panel chart"><h2>Quedas de material <span class="sub">por mês</span></h2>${barChart(S.map(s=>({l:lbl(s.m),v:s.quedas,hl:s.m===TM})),'crit')}</section>
    <section class="panel chart"><h2>Horas extras <span class="sub">h por mês</span></h2>${barChart(S.map(s=>({l:lbl(s.m),v:Math.round(s.he*10)/10,hl:s.m===TM})),'warn')}</section>
    <section class="panel chart"><h2>Horas perdidas de equipamentos <span class="sub">h por mês</span></h2>${barChart(S.map(s=>({l:lbl(s.m),v:Math.round(s.hp*10)/10,hl:s.m===TM})),'pat')}</section>
  </div>
  <section class="panel" style="margin-top:16px">
    <h2>Resumo mensal <span class="sub">${has?'clique em Excel para baixar o mês':'os números aparecem conforme você usa o sistema'}</span></h2>
    <div class="htable-wrap"><table class="htable">
      <thead><tr><th>Mês</th><th>Concluídas</th><th>No prazo</th><th>Prazos do mês</th><th>Faltas</th><th>H. extras</th><th>H. perdidas</th><th>ICCC/ICCP</th><th>Quedas</th><th></th></tr></thead>
      <tbody>${S.slice().reverse().map(s=>`<tr class="${s.m===TM?'cur':''}"><td class="m">${monthLabel(s.m)}</td><td>${s.done}</td><td>${s.onTime==null?'—':s.onTime+'%'}</td><td>${s.dueDone}/${s.due}</td><td>${s.faltas}</td><td>${fmtH(s.he)} h</td><td>${fmtH(s.hp)} h</td><td>${s.ind}</td><td>${s.quedas}</td><td><button class="btn sm" data-export="${s.m}">${I.dl}Excel</button></td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

/* ================= Processos ================= */
function vProcess(){
  const list=PROCS.filter(p=>!Q||(p.t+' '+p.d.join(' ')+' '+[...p.arc,...p.dik].map(k=>PEOPLE[k].n).join(' ')).toLowerCase().includes(Q));
  return `<section class="panel" style="margin-bottom:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
    <label class="switch"><input type="checkbox" id="autoR" ${routineOn()?'checked':''}><span><b>Rotina automática</b><br><span class="code">Ao abrir o sistema, cria as tarefas diárias do dia útil e as semanais (Bateria na segunda, Queda Zero na terça, Pátio na sexta) e o fechamento mensal da Medição.</span></span></label>
    <span style="flex:1"></span><button class="btn" id="genWeek">${I.plus}Gerar rotina da semana agora</button></section>
  <div class="procs">${list.map(p=>{const open=tasks().filter(t=>t.pid===p.id&&t.status!=='done').length;
    return `<article class="panel proc">
      <div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="code">${p.id}</span>${tag(p.a)}${prio(p.p)}</div><h3>${esc(p.t)}</h3></div>
      <div class="facts"><div><span class="eyebrow">Frequência</span><b>${p.freq}</b></div><div><span class="eyebrow">Prazo</span><b>${p.prazo}</b></div><div><span class="eyebrow">Em aberto</span><b class="mono">${open}</b></div></div>
      <ol class="steps">${p.d.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
      <div class="resp">
        <div><span class="eyebrow">Arcelor</span><ul>${p.arc.map(k=>`<li>${av(k)}${esc(PEOPLE[k].n)}</li>`).join('')||'<li class="code">Não definido</li>'}</ul></div>
        <div><span class="eyebrow">Dikma</span><ul>${p.dik.map(k=>`<li>${av(k)}${esc(PEOPLE[k].n)}</li>`).join('')}</ul></div>
      </div>
      <div class="actions"><button class="btn primary sm" data-fromproc="${p.id}">${I.plus}Criar tarefa</button>${p.id==='P01'?'<button class="btn sm" data-v="medicao">Abrir Medição</button>':''}${p.id==='P06'?'<button class="btn sm" data-v="queda">Abrir Queda Zero</button>':''}<button class="btn ghost sm" data-filterproc="${p.a}">Ver no quadro</button></div>
    </article>`}).join('')}</div>`;
}

/* ================= Equipe ================= */
function vTeam(){
  const grp=c=>Object.entries(PEOPLE).filter(([,p])=>p.c===c).filter(([,p])=>!Q||(p.n+' '+p.r).toLowerCase().includes(Q));
  const block=(c,title)=>`<div class="section-t">${title}<span class="code">${grp(c).length} pessoas</span></div>
  <div class="team" style="margin-bottom:24px">${grp(c).map(([k,p])=>{const procs=PROCS.filter(x=>x.arc.includes(k)||x.dik.includes(k));const open=tasks().filter(t=>(t.resp||[]).includes(k)&&t.status!=='done');const late=open.filter(isLate).length;
    return `<article class="panel person"><div class="top-p">${av(k)}<div><div class="nm">${esc(p.n)}</div><div class="rl">${esc(p.r)}</div></div></div>
    <div class="stats"><span><b>${procs.length}</b>processos</span><span><b>${open.length}</b>em aberto</span><span><b style="${late?'color:var(--crit)':''}">${late}</b>atrasadas</span></div>
    <div class="pl">${procs.map(x=>`<span class="tag ${x.a}" title="${esc(x.t)}">${x.id}</span>`).join('')}</div>
    <button class="btn ghost sm" data-filterperson="${k}" style="align-self:flex-start">Ver tarefas</button></article>`}).join('')}</div>`;
  return block('dik','Dikma')+block('arc','Arcelor');
}

/* ================= Modal de tarefa ================= */
let editing=null, confirmDel=false;
function openTask(id,preset){
  confirmDel=false;
  if(id){const t=ST.tasks[id];if(!t)return;editing=clone(t);editing._new=false}
  else editing={id:'t'+nid(),pid:'',title:'',area:'ger',prio:'media',due:ymd(WORKDAY),status:'todo',resp:['wanderson'],checklist:[],notes:'',createdAt:new Date().toISOString(),completedAt:null,_new:true,...(preset||{})};
  renderModal();
}
function renderModal(){
  const r=document.getElementById('modalRoot');
  if(!editing){r.innerHTML='';return}
  const t=editing;const p=progOf(t);
  r.innerHTML=`<div class="overlay" id="ov"><div class="modal" role="dialog" aria-modal="true" aria-label="Tarefa">
    <div class="modal-h">${tag(t.area)}${prio(t.prio)}<span class="code">${t.pid||'AVULSA'}${t.completedAt?' · concluída em '+fmtFull(cDay(t)):''}</span><button class="x" id="mClose" aria-label="Fechar">${I.x}</button></div>
    <div class="modal-b">
      <div>
        <input class="ttl-in" id="mTitle" value="${esc(t.title)}" placeholder="Título da tarefa" aria-label="Título">
        <div class="fld"><span class="lb">Checklist · ${p.k}/${p.n}</span>
          <div class="meter" style="margin-bottom:6px"><i style="width:${p.pct}%"></i></div>
          <div class="cl">${(t.checklist||[]).map((c,i)=>`<label class="cl-i ${c.ok?'done':''}"><input type="checkbox" data-ci="${i}" ${c.ok?'checked':''}><span>${esc(c.t)}</span><button type="button" data-cdel="${i}" aria-label="Remover item">${I.x}</button></label>`).join('')}</div>
          <form class="cl-add" id="clForm"><input id="clNew" placeholder="Adicionar item ao checklist" aria-label="Novo item"><button class="btn" type="submit">Adicionar</button></form>
        </div>
        <div class="fld"><label for="mNotes">Observações</label><textarea id="mNotes" placeholder="Pendências, links do PowerPoint, números lançados…">${esc(t.notes||'')}</textarea></div>
      </div>
      <div>
        <div class="fld"><label for="mStatus">Status</label><select id="mStatus">${STATUS.map(([k,l])=>`<option value="${k}" ${t.status===k?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="fld"><label for="mDue">Prazo</label><input type="date" id="mDue" value="${t.due}"></div>
        <div class="fld"><label for="mProc">Processo</label><select id="mProc"><option value="">Tarefa avulsa</option>${PROCS.map(x=>`<option value="${x.id}" ${t.pid===x.id?'selected':''}>${x.id} · ${esc(x.t)}</option>`).join('')}</select></div>
        <div class="fld"><label for="mArea">Área</label><select id="mArea">${Object.entries(AREAS).map(([k,l])=>`<option value="${k}" ${t.area===k?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="fld"><label for="mPrio">Prioridade</label><select id="mPrio">${Object.entries(PRIO).map(([k,l])=>`<option value="${k}" ${t.prio===k?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="fld"><span class="lb">Responsáveis</span><div class="pick">${Object.entries(PEOPLE).map(([k,pp])=>`<button type="button" data-pk="${k}" aria-pressed="${(t.resp||[]).includes(k)}">${av(k)}${esc(pp.n.split(' ')[0])}</button>`).join('')}</div></div>
      </div>
    </div>
    <div class="modal-f">
      ${t._new?'':(confirmDel?`<span class="confirm">Excluir esta tarefa?</span><button class="btn danger" id="mDelYes">Excluir</button><button class="btn ghost" id="mDelNo">Manter</button>`:`<button class="btn danger" id="mDel">Excluir</button>`)}
      <span class="grow"></span>
      <button class="btn" id="mCancel">Cancelar</button>
      <button class="btn primary" id="mSave">${t._new?'Criar tarefa':'Salvar'}</button>
    </div>
  </div></div>`;
  const $=id=>document.getElementById(id);
  const sync=()=>{t.title=$('mTitle').value;t.notes=$('mNotes').value;t.status=$('mStatus').value;t.due=$('mDue').value||t.due;t.area=$('mArea').value;t.prio=$('mPrio').value};
  const close=()=>{editing=null;renderModal()};
  $('mClose').onclick=close;$('mCancel').onclick=close;
  $('ov').addEventListener('mousedown',e=>{if(e.target.id==='ov')close()});
  r.querySelectorAll('[data-ci]').forEach(cb=>cb.onchange=()=>{sync();t.checklist[+cb.dataset.ci].ok=cb.checked;renderModal()});
  r.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=e=>{e.preventDefault();sync();t.checklist.splice(+b.dataset.cdel,1);renderModal()});
  $('clForm').onsubmit=e=>{e.preventDefault();const v=$('clNew').value.trim();if(!v)return;sync();t.checklist=t.checklist||[];t.checklist.push({t:v,ok:false});renderModal();document.getElementById('clNew').focus()};
  r.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>{sync();const k=b.dataset.pk;t.resp=(t.resp||[]).includes(k)?t.resp.filter(x=>x!==k):[...(t.resp||[]),k];renderModal()});
  $('mProc').onchange=()=>{sync();const pr=PROC[$('mProc').value];t.pid=$('mProc').value;if(pr){t.area=pr.a;t.prio=pr.p;if(!t.title)t.title=pr.t;if(!(t.checklist||[]).length)t.checklist=pr.d.map(x=>({t:x,ok:false}));if((t.resp||[]).length<=1)t.resp=[...new Set([...(t.resp||[]),...pr.arc.slice(0,2)])]}renderModal()};
  ['mArea','mPrio'].forEach(id=>$(id).onchange=()=>{sync();renderModal()});
  if($('mDel'))$('mDel').onclick=()=>{sync();confirmDel=true;renderModal()};
  if($('mDelNo'))$('mDelNo').onclick=()=>{confirmDel=false;renderModal()};
  if($('mDelYes'))$('mDelYes').onclick=()=>{const o=ST.tasks[t.id];if(o){if(o.routine)put('tasks',t.id,{...o,deleted:true});else put('tasks',t.id,null)}editing=null;renderModal();render();toast('Tarefa excluída')};
  $('mSave').onclick=()=>{sync();if(!t.title.trim()){$('mTitle').focus();$('mTitle').placeholder='Dê um título à tarefa';return}
    const isNew=t._new;delete t._new;
    if(t.status==='done')t.completedAt=t.completedAt||new Date().toISOString();else{const o=ST.tasks[t.id];if(o&&o.status==='done'&&Array.isArray(t.prevChecks)&&JSON.stringify((o.checklist||[]).map(i=>!!i.ok))===JSON.stringify((t.checklist||[]).map(i=>!!i.ok)))(t.checklist||[]).forEach((i,k)=>{if(k<t.prevChecks.length)i.ok=t.prevChecks[k]});delete t.prevChecks;t.completedAt=null}
    put('tasks',t.id,t);editing=null;renderModal();render();toast(isNew?'Tarefa criada':'Alterações salvas')};
  if(t._new)setTimeout(()=>$('mTitle').focus(),0);
}
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(editing){editing=null;renderModal()}else if(qEdit){qEdit=null;renderQueda()}else if(exp){exp=null;renderExport()}else document.getElementById('sheet').classList.remove('open')});

/* ================= Exportação Excel ================= */
let exp=null, xlsxP=null;
function loadXLSX(){
  if(window.__LOAD_XLSX)return window.__LOAD_XLSX();
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(!xlsxP)xlsxP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>res(window.XLSX);s.onerror=()=>{xlsxP=null;rej(new Error('load'))};document.head.appendChild(s)});
  return xlsxP;
}
function openExport(m){exp={period:m||TM,busy:false};renderExport()}
function renderExport(){
  const r=document.getElementById('modalRoot');
  if(!exp){r.innerHTML='';return}
  const ms=[...new Set([TM,shiftMonth(TM,-1),shiftMonth(TM,-2),...allRegs().map(r=>r.data.slice(0,7)),...tasks().map(t=>t.due.slice(0,7)),...quedas().map(q=>q.data.slice(0,7))])].filter(m=>m<=shiftMonth(TM,1)).sort().reverse();
  if(exp.period!=='all'&&!ms.includes(exp.period))ms.unshift(exp.period);
  r.innerHTML=`<div class="overlay" id="ov"><div class="modal narrow" role="dialog" aria-modal="true" aria-label="Exportar Excel">
    <div class="modal-h"><h3>Exportar para Excel</h3><button class="x" id="mClose" aria-label="Fechar">${I.x}</button></div>
    <div style="padding:18px;display:flex;flex-direction:column;gap:12px">
      <span class="code">Planilha com abas: Resumo, Tarefas, Faltas, Horas extras, Horas perdidas, ICCC-ICCP e Queda Zero.</span>
      <div class="opt-list">${ms.slice(0,6).map(m=>`<label><input type="radio" name="per" value="${m}" ${exp.period===m?'checked':''}><span style="text-transform:capitalize">${monthLabel(m)}</span></label>`).join('')}<label><input type="radio" name="per" value="all" ${exp.period==='all'?'checked':''}><span>Todo o histórico</span></label></div>
      <div id="expMsg" class="code" role="status"></div>
    </div>
    <div class="modal-f"><span class="grow"></span><button class="btn" id="mCancel">Cancelar</button><button class="btn primary" id="expGo" ${exp.busy?'disabled':''}>${I.dl}${exp.busy?'Gerando…':'Baixar .xlsx'}</button></div>
  </div></div>`;
  const $=id=>document.getElementById(id);
  const close=()=>{exp=null;renderExport()};
  $('mClose').onclick=close;$('mCancel').onclick=close;
  $('ov').addEventListener('mousedown',e=>{if(e.target.id==='ov')close()});
  r.querySelectorAll('input[name=per]').forEach(i=>i.onchange=()=>{exp.period=i.value});
  $('expGo').onclick=doExport;
}
async function doExport(){
  const per=exp.period;exp.busy=true;renderExport();
  const msg=t=>{const el=document.getElementById('expMsg');if(el)el.textContent=t};
  try{
    const dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;
    const inClaude=!!(window.claude&&window.claude.use);
    if(!dl&&inClaude){exp.busy=false;renderExport();msg('A exportação não está disponível nesta visualização. Abra o painel pelo Claude no navegador ou no app.');return}
    let X;try{X=await loadXLSX()}catch(e){exp.busy=false;renderExport();msg('Não foi possível carregar o gerador de Excel. Verifique a conexão e tente de novo.');return}
    const inP=s=>s&&(per==='all'||s.slice(0,7)===per);
    const d=s=>{if(!s)return '';const [y,m,dd]=s.slice(0,10).split('-').map(Number);return (Date.UTC(y,m-1,dd)-Date.UTC(1899,11,30))/864e5};
    const DATECOLS=['Prazo','Concluída em','Data'];
    const T=tasks().filter(t=>inP(t.due)||inP(cDay(t))).sort((a,b)=>a.due.localeCompare(b.due));
    const R=(per==='all'?allRegs():regsOf(per)).slice().sort((a,b)=>a.data.localeCompare(b.data));
    const QZ=quedas().filter(q=>inP(q.data)).reverse();
    const sheet=(rows,cols)=>{const ws=X.utils.json_to_sheet(rows.length?rows:[Object.fromEntries(cols.map(c=>[c[0],'']))]);ws['!cols']=cols.map(c=>({wch:c[1]}));const rg=X.utils.decode_range(ws['!ref']);cols.forEach((c,ci)=>{if(!DATECOLS.includes(c[0]))return;for(let r=1;r<=rg.e.r;r++){const cell=ws[X.utils.encode_cell({r,c:ci})];if(cell&&typeof cell.v==='number')cell.z='dd/mm/yyyy'}});return ws};
    const wb=X.utils.book_new();
    const months=per==='all'?[...new Set([...T.map(t=>t.due.slice(0,7)),...R.map(r=>r.data.slice(0,7)),...QZ.map(q=>q.data.slice(0,7))])].sort():[per];
    X.utils.book_append_sheet(wb,sheet(months.map(m=>{const s=monthStats(m);return {'Mês':monthLabel(m),'Tarefas concluídas':s.done,'% no prazo':s.onTime==null?'':s.onTime/100,'Prazos no mês':s.due,'Prazos cumpridos':s.dueDone,'Faltas':s.faltas,'Horas extras (h)':Math.round(s.he*100)/100,'Horas perdidas (h)':Math.round(s.hp*100)/100,'Correções ICCC/ICCP':s.ind,'Quedas de material':s.quedas}}),[['Mês',16],['Tarefas concluídas',18],['% no prazo',11],['Prazos no mês',14],['Prazos cumpridos',16],['Faltas',8],['Horas extras (h)',16],['Horas perdidas (h)',17],['Correções ICCC/ICCP',19],['Quedas de material',18]]),'Resumo');
    const wsR=wb.Sheets['Resumo'];if(wsR){const rg=X.utils.decode_range(wsR['!ref']);for(let r=1;r<=rg.e.r;r++){const c=wsR[X.utils.encode_cell({r,c:2})];if(c&&typeof c.v==='number')c.z='0%'}}
    X.utils.book_append_sheet(wb,sheet(T.map(t=>({'Processo':t.pid||'Avulsa','Tarefa':t.title,'Área':AREAS[t.area],'Prioridade':PRIO[t.prio],'Status':STATUS_L[t.status],'Prazo':d(t.due),'Concluída em':d(cDay(t)),'Situação':t.status==='done'?((cDay(t)||'')<=t.due?'No prazo':'Fora do prazo'):(isLate(t)?'Atrasada':'Em dia'),'Responsáveis':(t.resp||[]).map(k=>PEOPLE[k]?.n).join(', '),'Checklist':`${progOf(t).k}/${progOf(t).n}`,'Observações':t.notes||''})),[['Processo',9],['Tarefa',42],['Área',16],['Prioridade',10],['Status',14],['Prazo',11],['Concluída em',13],['Situação',13],['Responsáveis',30],['Checklist',9],['Observações',40]]),'Tarefas');
    const rr=(tp,map,cols,name)=>X.utils.book_append_sheet(wb,sheet(R.filter(r=>r.tipo===tp).map(map),cols),name);
    rr('falta',r=>({'Data':d(r.data),'Colaborador':r.quem,'Área':AREAS[r.area]||'','Tipo':r.cat,'Justificativa':r.desc||'','Lançado':r.lancado?'Sim':'Não'}),[['Data',11],['Colaborador',28],['Área',16],['Tipo',18],['Justificativa',40],['Lançado',9]],'Faltas');
    rr('he',r=>({'Data':d(r.data),'Colaborador':r.quem,'Área':AREAS[r.area]||'','Horas':num(r.horas),'Motivo':r.desc||'','Lançado':r.lancado?'Sim':'Não'}),[['Data',11],['Colaborador',28],['Área',16],['Horas',8],['Motivo',40],['Lançado',9]],'Horas extras');
    rr('hp',r=>({'Data':d(r.data),'Equipamento':r.quem,'Área':AREAS[r.area]||'','Motivo':r.cat,'Horas':num(r.horas),'Observação':r.desc||'','Lançado':r.lancado?'Sim':'Não'}),[['Data',11],['Equipamento',26],['Área',16],['Motivo',22],['Horas',8],['Observação',36],['Lançado',9]],'Horas perdidas');
    rr('ind',r=>({'Data':d(r.data),'Indicador':r.cat,'Divergência':r.desc||'','Situação':r.status==='corrigido'?'Corrigido':'Pendente'}),[['Data',11],['Indicador',10],['Divergência',60],['Situação',11]],'ICCC-ICCP');
    X.utils.book_append_sheet(wb,sheet(QZ.map(q=>({'Data':d(q.data),'Área':AREAS[q.area]||'','Local':q.local||'','Material':q.material||'','Quantidade':q.qtd||'','Origem':q.origem||'','Descrição':q.desc||'','Plano de ação':QZ_PLANO[q.plano]||'','Ação definida':q.acao||'','Power BI':q.powerbi?'Lançado':'Pendente','Apresentada ao cliente':q.apresentado?'Sim':'Não'})),[['Data',11],['Área',16],['Local',30],['Material',14],['Quantidade',12],['Origem',18],['Descrição',44],['Plano de ação',20],['Ação definida',36],['Power BI',10],['Apresentada ao cliente',20]]),'Queda Zero');
    const buf=X.write(wb,{bookType:'xlsx',type:'array'});
    const name=`Painel Coqueria - ${per==='all'?'historico completo':monthLabel(per)}.xlsx`;
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    try{if(dl)await dl.save({filename:name,data:blob});else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}exp=null;renderExport();toast('Planilha exportada')}
    catch(e){exp.busy=false;renderExport();const c=e&&e.code;msg(c==='declined'?'Download cancelado.':c==='rate_limited'?'Já existe um download aguardando confirmação.':'Não foi possível salvar o arquivo nesta visualização.')}
  }catch(e){if(exp){exp.busy=false;renderExport();msg('Algo deu errado ao gerar a planilha. Tente de novo.')}}
}

/* ================= Render ================= */
let lastView=null, rT=null;
function scheduleRender(){clearTimeout(rT);rT=setTimeout(()=>render(false),60)}
function render(fresh){
  clearTimeout(rT);
  const c=document.getElementById('content');
  let keep=null;
  if(!fresh&&lastView===view){
    keep={vals:{},scroll:c.scrollTop,focus:null,sel:null};
    c.querySelectorAll('input[id],select[id],textarea[id]').forEach(el=>{keep.vals[el.id]=el.type==='checkbox'?el.checked:el.value});
    const a=document.activeElement;if(a&&a.id&&c.contains(a)){keep.focus=a.id;try{keep.sel=[a.selectionStart,a.selectionEnd]}catch(e){}}
    const bw=c.querySelector('.board-wrap');if(bw)keep.bx=bw.scrollLeft;
  }
  renderNav();
  try{history.replaceState(null,'','#'+view)}catch(e){}
  c.innerHTML=({overview:vOverview,board:vBoard,agenda:vAgenda,medicao:vMedicao,queda:vQueda,historico:vHistorico,process:vProcess,team:vTeam}[view])();
  if(keep){
    for(const id in keep.vals){const el=document.getElementById(id);if(!el||!c.contains(el))continue;if(el.type==='checkbox'){if(el.id.startsWith('r_'))el.checked=keep.vals[id]}else if(el.id.startsWith('r_'))el.value=keep.vals[id]}
    c.scrollTop=keep.scroll;const bw=c.querySelector('.board-wrap');if(bw&&keep.bx)bw.scrollLeft=keep.bx;
    if(keep.focus){const el=document.getElementById(keep.focus);if(el){el.focus({preventScroll:true});if(keep.sel&&keep.sel[0]!=null)try{el.setSelectionRange(keep.sel[0],keep.sel[1])}catch(e){}}}
  }
  lastView=view;
  bind();
}
function bind(){
  const c=document.getElementById('content');
  const on=(sel,fn,ev='click')=>c.querySelectorAll(sel).forEach(el=>el.addEventListener(ev,e=>fn(el,e)));
  const $=id=>document.getElementById(id);
  on('[data-open]',b=>openTask(b.dataset.open));
  on('[data-quick]',cb=>{const t=ST.tasks[cb.dataset.quick];if(!t)return;setStatus(t,cb.checked?'done':'todo');render();toast(cb.checked?'Concluída':'Reaberta')},'change');
  on('[data-goto]',b=>{F={area:'all',prio:'all',person:'all',late:b.dataset.goto==='late'};Q='';$('q').value='';view='board';render(true)});
  on('[data-medtab]',b=>{medTab=b.dataset.medtab;if(view!=='medicao'){view='medicao';medMonth=TM}armed=null;render(true)});
  on('[data-export]',b=>openExport(b.dataset.export));
  if($('genRoutine'))$('genRoutine').onclick=()=>genManual(false);
  if($('genWeek'))$('genWeek').onclick=()=>genManual(true);
  if($('autoR'))$('autoR').onchange=e=>{put('config','main',{...(ST.config.main||{}),autoRoutine:e.target.checked});toast(e.target.checked?'Rotina automática ligada':'Rotina automática desligada')};
  // filtros
  on('[data-fa]',b=>{F.area=b.dataset.fa;render(true)});
  if($('fPrio'))$('fPrio').onchange=e=>{F.prio=e.target.value;render(true)};
  if($('fPerson'))$('fPerson').onchange=e=>{F.person=e.target.value;render(true)};
  if($('fLate'))$('fLate').onclick=()=>{F.late=!F.late;render(true)};
  if($('clearF'))$('clearF').onclick=()=>{F={area:'all',prio:'all',person:'all',late:false};Q='';$('q').value='';render(true)};
  on('[data-addcol]',b=>openTask(null,{status:b.dataset.addcol,area:F.area!=='all'?F.area:'ger'}));
  on('[data-addday]',b=>openTask(null,{due:b.dataset.addday}));
  on('[data-fromproc]',b=>{const p=PROC[b.dataset.fromproc];openTask(null,{pid:p.id,title:`${p.t} · ${fmtShort(ymd(WORKDAY))}`,area:p.a,prio:p.p,checklist:p.d.map(t=>({t,ok:false})),resp:respOf(p)})});
  on('[data-filterproc]',b=>{F={area:b.dataset.filterproc,prio:'all',person:'all',late:false};view='board';render(true)});
  on('[data-filterperson]',b=>{F={area:'all',prio:'all',person:b.dataset.filterperson,late:false};Q='';$('q').value='';view='board';render(true)});
  // agenda
  if($('calPrev')){$('calPrev').onclick=()=>{calStart=addD(calStart,-7);render(true)};$('calNext').onclick=()=>{calStart=addD(calStart,7);render(true)};$('calToday').onclick=()=>{calStart=mondayOf(WORKDAY);render(true)}}
  // medição
  if($('mPrev')){$('mPrev').onclick=()=>{medMonth=shiftMonth(medMonth,-1);render(true)};$('mNext').onclick=()=>{medMonth=shiftMonth(medMonth,1);render(true)};if($('mNow'))$('mNow').onclick=()=>{medMonth=TM;render(true)}}
  if($('regForm'))$('regForm').onsubmit=e=>{
    e.preventDefault();const g=id=>{const el=$(id);return el?el.value.trim():''};
    const data=g('r_data');if(!data)return;
    const it={id:'r'+nid(),tipo:medTab,data,quem:g('r_quem'),area:g('r_area')||'ger',cat:g('r_cat'),horas:REG[medTab].hours?num(g('r_horas')):0,desc:g('r_desc'),lancado:false,status:medTab==='ind'?'pendente':'',ts:Date.now()};
    const m=data.slice(0,7);put('registros',it.id,it);
    const keepDate=data,keepArea=g('r_area');
    if(m!==medMonth)medMonth=m;
    render(true);
    if($('r_data'))$('r_data').value=keepDate;if($('r_area')&&keepArea)$('r_area').value=keepArea;
    const f=$('r_quem')||$('r_desc');if(f&&window.matchMedia('(min-width:821px)').matches)f.focus();
    toast(`${REG[medTab].one[0].toUpperCase()+REG[medTab].one.slice(1)} registrada`);
  };
  on('[data-rtog]',b=>{const o=ST.registros[b.dataset.rtog];if(!o)return;const r=clone(o);if(r.tipo==='ind')r.status=r.status==='corrigido'?'pendente':'corrigido';else r.lancado=!r.lancado;put('registros',r.id,r);render()});
  on('[data-rdel]',b=>{const id=b.dataset.rdel;if(armed!==id){armed=id;render();setTimeout(()=>{if(armed===id){armed=null;render()}},4000);return}armed=null;if(ST.registros[id]){put('registros',id,null);toast('Registro excluído')}render()});
  // queda
  if($('qzNew'))$('qzNew').onclick=()=>openQueda();
  if($('qzNew2'))$('qzNew2').onclick=()=>openQueda();
  if($('qzMonth'))$('qzMonth').onchange=e=>{qzMonth=e.target.value;render(true)};
  on('[data-qz]',el=>openQueda(el.dataset.qz));
  on('[data-qz]',(el,e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openQueda(el.dataset.qz)}},'keydown');
  // kanban
  c.querySelectorAll('.card').forEach(el=>{
    el.addEventListener('click',e=>{if(e.target.closest('[data-mv]'))return;openTask(el.dataset.id)});
    el.addEventListener('keydown',e=>{if(e.target!==el)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();openTask(el.dataset.id)}});
    el.addEventListener('dragstart',e=>{el.classList.add('dragging');e.dataTransfer.setData('text/plain',el.dataset.id);e.dataTransfer.effectAllowed='move'});
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
  });
  on('[data-mv]',(b,e)=>{e.stopPropagation();const t=ST.tasks[b.dataset.mv];if(!t)return;setStatus(t,b.dataset.to);render();toast(`Movida para ${STATUS_L[b.dataset.to]}`)});
  c.querySelectorAll('.col').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('over')});
    col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('over')});
    col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('over');const t=ST.tasks[e.dataTransfer.getData('text/plain')];if(t&&t.status!==col.dataset.col){setStatus(t,col.dataset.col);render();toast(`Movida para ${STATUS_L[col.dataset.col]}`)}});
  });
}

/* ================= Topo e tema ================= */
document.getElementById('today').textContent=`${WD[TODAY.getDay()]}, ${TODAY.getDate()} de ${MONTHS[TODAY.getMonth()]}`;
document.getElementById('newTask').onclick=()=>openTask(null);
document.getElementById('exportBtn').onclick=()=>openExport(view==='medicao'?medMonth:TM);
let qt;document.getElementById('q').addEventListener('input',e=>{clearTimeout(qt);qt=setTimeout(()=>{Q=e.target.value.trim().toLowerCase();if(view==='overview'||view==='agenda'||view==='historico')view='board';render(true)},180)});
function applyTheme(){if(THEME==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',THEME);
  document.querySelectorAll('#themeRow button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===THEME))}
document.querySelectorAll('#themeRow button').forEach(b=>b.onclick=()=>{THEME=b.dataset.t;try{localStorage.setItem(CK+'-theme',THEME)}catch(e){}applyTheme()});
applyTheme();
render(true);refreshSync();

/* ================= Conexão com a nuvem ================= */
(async()=>{
  let d=null;
  if(window.claude&&window.claude.use){try{d=await window.claude.use('db')}catch(e){d=null}}
  else if(window.__FBMOD){startFirebase(window.__FBMOD);return}
  if(!d){mode='local';QUEUE=[];saveCache();refreshSync();maybeRoutine();render();return}
  db=d;
  ['tasks','registros','quedas','config'].forEach(subscribe);
  flush();
})();

/* ================= Firebase (versão dentro do Dikma Gestão) ================= */
async function startFirebase(M){
  FB=true;mode='connecting';refreshSync();
  let cfg=null;
  try{const r=await fetch('/__/firebase/init.json',{cache:'no-store'});if(r.ok){cfg=await r.json();try{localStorage.setItem('coqueria-fbcfg',JSON.stringify(cfg))}catch(e){}}}catch(e){}
  if(!cfg){try{cfg=JSON.parse(localStorage.getItem('coqueria-fbcfg')||'null')}catch(e){}}
  if(!cfg||!cfg.apiKey){FB=false;mode='local';QUEUE=[];saveCache();refreshSync();maybeRoutine();render();return}
  const app=M.initializeApp(cfg), auth=M.getAuth(app);
  const fs=M.initializeFirestore(app,{localCache:M.persistentLocalCache({tabManager:M.persistentMultipleTabManager()})});
  const USO='dikma-ultimo-uso';
  const login=document.getElementById('login'), lmsg=document.getElementById('loginMsg');
  document.getElementById('loginForm').onsubmit=async e=>{
    e.preventDefault();lmsg.textContent='';
    const u=document.getElementById('lgUser').value.trim().toLowerCase(), pw=document.getElementById('lgPass').value;
    if(!u||!pw){lmsg.textContent='Informe usuário e senha.';return}
    const bt=document.getElementById('loginBtn');bt.disabled=true;bt.textContent='Entrando…';
    try{const l=await M.getDoc(M.doc(fs,'logins',u));if(!l.exists())throw {code:'login/nao-existe'};await M.signInWithEmailAndPassword(auth,l.data().email,pw)}
    catch(err){const c=err&&err.code||'';lmsg.textContent=c==='login/nao-existe'||c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')?'Usuário ou senha incorretos.':c.includes('too-many-requests')?'Muitas tentativas. Aguarde alguns minutos.':c.includes('network')||c==='unavailable'?'Sem conexão. Tente de novo quando tiver sinal.':'Não foi possível entrar ('+c+').'}
    finally{bt.disabled=false;bt.textContent='Entrar'}
  };
  document.getElementById('logoutBtn').onclick=async()=>{await M.signOut(auth);try{localStorage.removeItem(CK)}catch(e){}location.reload()};
  let started=false;
  M.onAuthStateChanged(auth,u=>{
    if(!u){login.hidden=false;document.getElementById('acct').hidden=true;return}
    // Mesma regra do Dikma Gestão: a sessão vale 7 dias sem uso.
    try{const t=+localStorage.getItem(USO)||0;if(t&&Date.now()-t>7*864e5){localStorage.removeItem(USO);M.signOut(auth);return}if(Date.now()-t>6e5)localStorage.setItem(USO,String(Date.now()))}catch(e){}
    login.hidden=true;
    document.getElementById('acct').hidden=false;document.getElementById('acctEmail').textContent=(u.email||'').split('@')[0];
    if(started)return;started=true;
    const col=c=>M.collection(fs,'painel',u.uid,c), ref=(c,id)=>M.doc(fs,'painel',u.uid,c,id);
    const fail=e=>{if(e&&e.code==='permission-denied')toast('Seu usuário não tem permissão para salvar no painel.')};
    db={
      collection(c){return {onSnapshot(next,err){
        return M.onSnapshot(col(c),{includeMetadataChanges:true},s=>{
          fbPending[c]=s.metadata.hasPendingWrites;
          next({docs:s.docs.map(d=>({id:d.id,exists:true,data:()=>d.data(),metadata:s.metadata})),metadata:{fromCache:s.metadata.fromCache,hasPendingWrites:s.metadata.hasPendingWrites}});
          refreshSync();
        },e=>{if(e&&e.code==='permission-denied')toast('Seu usuário não tem acesso ao painel. Fale com o administrador.');err&&err({code:'unavailable',message:String(e&&e.message)})})}}},
      doc(path){const [c,id]=path.split('/');const r=ref(c,id);
        return {set:d=>{M.setDoc(r,d).catch(fail);return Promise.resolve()},delete:()=>{const b=M.writeBatch(fs);b.delete(r);b.commit().catch(fail);return Promise.resolve()}}}
    };
    ['tasks','registros','quedas','config'].forEach(subscribe);
    flush();
  });
}
})();
