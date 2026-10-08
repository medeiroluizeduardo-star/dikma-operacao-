// Senior X (nuvem): login na plataforma e consulta paginada de colaboradores.
// Endereços padrão da plataforma; se a Dikma usar outros, configure SENIOR_URL e os caminhos abaixo.
const BASE = 'https://platform.senior.com.br/t/senior.com.br/bridge/1.0';
const P_LOGIN = '/rest/platform/authentication/actions/login';
const P_LOGIN_CHAVE = '/rest/platform/authentication/actions/loginWithKey';
const P_LISTA = '/rest/hcm/payroll/queries/employeeListQuery';
const P_DETALHE = '/rest/hcm/payroll/queries/employeeQuery';

async function post(url, corpo, token) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(corpo) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { /* resposta não é JSON */ }
  if (!r.ok) throw new Error(`Senior respondeu ${r.status} em ${url.replace(/\/\/[^/]+/, '//…')}: ${(j && (j.message || j.errorMessage)) || t.slice(0, 200)}`);
  return j || {};
}
// O token pode vir direto ou dentro de "jsonToken" (texto JSON).
function tokenDe(resp) {
  if (resp.access_token) return resp.access_token;
  const jt = resp.jsonToken || (resp.token && resp.token.jsonToken);
  if (jt) { const o = typeof jt === 'string' ? JSON.parse(jt) : jt; if (o.access_token) return o.access_token; }
  throw new Error('O login no Senior não devolveu o token de acesso. Confira usuário, senha e tenant.');
}
// Acha a lista de colaboradores na resposta, qualquer que seja o nome do campo.
function listaDe(resp) {
  for (const k of ['contents', 'content', 'employees', 'result', 'results', 'items', 'data']) if (Array.isArray(resp[k])) return resp[k];
  const arr = Object.values(resp).find(v => Array.isArray(v)); return arr || [];
}

export async function buscar({ env }) {
  const base = (env('SENIOR_URL') || BASE).replace(/\/$/, '');
  const tenant = env('SENIOR_TENANT');
  let login;
  if (env('SENIOR_CHAVE') && env('SENIOR_SEGREDO')) login = await post(base + P_LOGIN_CHAVE, { accessKey: env('SENIOR_CHAVE'), secret: env('SENIOR_SEGREDO'), tenantName: tenant });
  else {
    if (!env('SENIOR_USUARIO') || !env('SENIOR_SENHA')) throw new Error('Faltam SENIOR_USUARIO e SENIOR_SENHA (ou SENIOR_CHAVE e SENIOR_SEGREDO).');
    const u = env('SENIOR_USUARIO'); login = await post(base + P_LOGIN, { username: u.includes('@') || !tenant ? u : `${u}@${tenant}`, password: env('SENIOR_SENHA') });
  }
  const token = tokenDe(login);
  const tam = 100, todos = [];
  for (let pag = 0; pag < 200; pag++) {
    const corpo = { page: { current: pag, size: tam } };
    if (env('SENIOR_DEPARTAMENTO')) corpo.departmentId = env('SENIOR_DEPARTAMENTO');
    const l = listaDe(await post(base + P_LISTA, corpo, token));
    todos.push(...l);
    if (l.length < tam) break;
  }
  // Opcional: busca o detalhe de cada um quando a lista vem resumida (SENIOR_DETALHAR=1).
  if (env('SENIOR_DETALHAR') === '1') {
    for (let i = 0; i < todos.length; i++) {
      const id = todos[i].id || todos[i].employeeId; if (!id) continue;
      try { const d = await post(base + P_DETALHE, { employeeId: id }, token); todos[i] = { ...todos[i], ...(d.employee || d.result || d) }; } catch (e) { /* mantém o resumo */ }
    }
  }
  return todos;
}
