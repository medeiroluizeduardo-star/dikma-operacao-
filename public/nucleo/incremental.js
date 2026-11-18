// Coleções grandes que quase não mudam (Treinamentos e ASO: ~1.900 registros; Férias: ~400).
// Antes, cada abertura do sistema relia a coleção inteira no servidor (cada documento = 1 leitura da cota grátis de
// 50 mil por dia): com os Indicadores ligados para todos, 20 pessoas abrindo o sistema algumas vezes estouravam a cota.
// Agora a tela usa a cópia do aparelho (sem leitura) e o servidor manda só o que mudou desde a última vez
// (atualizadoEm maior que o mais novo da cópia). A cada INC_DIAS, ou com a cópia vazia (aparelho novo, outro usuário,
// cópia apagada), relê tudo uma vez.
// Excluir vira "apagado: true" com atualizadoEm (nucleo/data.js), para os outros aparelhos saberem; a lista que a tela
// recebe já vem sem os apagados. A rotina diária dos avisos (integracao/avisos/avisos.mjs) apaga de vez os marcados há
// mais de 45 dias, bem mais que INC_DIAS: nenhum aparelho perde uma exclusão.
export const INC_DIAS = 20;

const ms = t => (t && t.toMillis ? t.toMillis() : 0);
const guardaPadrao = {
  ler: k => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } },
  gravar: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* sem armazenamento: relê tudo da próxima vez */ } }
};

// fb: { onSnapshot, collection, query, where } do Firebase · chave: onde guardar quando foi a última leitura completa.
// fn(lista, pronta): pronta = já tem a resposta do servidor ou uma cópia do aparelho para mostrar.
// Devolve a função que desliga as escutas.
export function ouvirIncremental(fb, db, col, chave, fn, onErr = () => {}, guarda = guardaPadrao) {
  const ref = fb.collection(db, col);
  const recente = Date.now() - guarda.ler(chave) < INC_DIAS * 864e5;
  let servidor = false, temCopia = false, srv = null, vivo = true, primeira = true, ult = [];
  const local = fb.onSnapshot(ref, { source: 'cache' }, qs => {
    if (!vivo) return;
    if (primeira) {
      primeira = false;
      let desde = null;
      if (recente) for (const d of qs.docs) { const t = d.get('atualizadoEm'); if (ms(t) > ms(desde)) desde = t; }
      temCopia = !!desde;
      // includeMetadataChanges: sem ele, quando o servidor só confirma o que o aparelho já tem (nada mudou), o Firebase
      // não avisa (só muda o fromCache), e a tela ficava carregando para sempre (aparelho com cópia mas sem a marca).
      srv = fb.onSnapshot(desde ? fb.query(ref, fb.where('atualizadoEm', '>', desde)) : ref, { includeMetadataChanges: true }, s => {
        if (s.metadata.fromCache || servidor || !vivo) return;
        servidor = true; if (!desde) guarda.gravar(chave, Date.now()); fn(ult, true);
      }, e => { servidor = true; if (vivo) fn(ult, true); onErr(e); });
    }
    ult = qs.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => !x.apagado);
    fn(ult, servidor || temCopia);
  }, e => onErr(e));
  return () => { vivo = false; local(); if (srv) srv(); };
}
