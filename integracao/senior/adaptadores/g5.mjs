// Senior G5 instalado na empresa (HCM / Administração de Pessoal): web service SOAP.
// A TI informa o endereço do serviço (SENIOR_G5_URL), a porta (SENIOR_G5_PORTA) e, se precisar,
// os parâmetros (SENIOR_G5_PARAMETROS, em JSON). Exemplo de endereço:
//   http://servidor:8080/g5-senior-services/rubi_Synccom_senior_g5_rh_..._colaboradores
// Atenção: o GitHub só alcança o servidor se a TI liberar acesso externo a ele.
import { XMLParser } from 'fast-xml-parser';

const escXml = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

// Acha a maior lista de objetos parecidos dentro da resposta (as linhas de colaboradores).
function maiorLista(no, melhor = []) {
  if (Array.isArray(no)) { const objs = no.filter(x => x && typeof x === 'object' && !Array.isArray(x)); if (objs.length > melhor.length) melhor = objs; no.forEach(x => { melhor = maiorLista(x, melhor); }); }
  else if (no && typeof no === 'object') for (const v of Object.values(no)) melhor = maiorLista(v, melhor);
  return melhor;
}

export async function buscar({ env }) {
  const url = env('SENIOR_G5_URL'), porta = env('SENIOR_G5_PORTA');
  if (!url || !porta) throw new Error('Faltam SENIOR_G5_URL e SENIOR_G5_PORTA (endereço e porta do web service, informados pela TI).');
  if (!env('SENIOR_USUARIO') || !env('SENIOR_SENHA')) throw new Error('Faltam SENIOR_USUARIO e SENIOR_SENHA.');
  let params = {};
  if (env('SENIOR_G5_PARAMETROS')) { try { params = JSON.parse(env('SENIOR_G5_PARAMETROS')); } catch (e) { throw new Error('SENIOR_G5_PARAMETROS não é um JSON válido.'); } }
  const p = Object.entries(params).map(([k, v]) => `<${k}>${escXml(v)}</${k}>`).join('');
  const envelope = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://services.senior.com.br"><soapenv:Body><ser:${porta}><user>${escXml(env('SENIOR_USUARIO'))}</user><password>${escXml(env('SENIOR_SENHA'))}</password><encryption>${env('SENIOR_G5_CRIPTOGRAFIA') || '0'}</encryption><parameters>${p}</parameters></ser:${porta}></soapenv:Body></soapenv:Envelope>`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' }, body: envelope });
  const xml = await r.text();
  if (!r.ok) throw new Error(`Web service do Senior respondeu ${r.status}: ${xml.slice(0, 300)}`);
  const doc = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, isArray: (n, jp, folha) => !folha && jp.split('.').length >= 4 }).parse(xml);
  const corpo = doc.Envelope && doc.Envelope.Body;
  const erro = JSON.stringify(corpo || {}).match(/"erroExecucao":"([^"]+)"/);
  if (erro) throw new Error('Senior: ' + erro[1]);
  if (corpo && corpo.Fault) throw new Error('Senior: ' + JSON.stringify(corpo.Fault).slice(0, 300));
  return maiorLista(corpo);
}
