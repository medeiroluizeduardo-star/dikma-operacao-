// App Check: prova para o Firebase que quem está usando o banco é este site (e não um programa por fora).
// Enquanto CHAVE_SITE estiver vazia, nada muda. Para ligar:
//   1) Google Cloud › reCAPTCHA: criar uma chave do tipo "Site" para o domínio dikma-operacao.web.app
//      (e dikma-operacao.firebaseapp.com). A chave do site é pública (aparece no navegador), não é segredo.
//   2) Firebase › App Check › Apps: registrar o app da Web com o provedor reCAPTCHA Enterprise e essa chave;
//      em "Duração do token" escolher 1 dia (gasta menos da cota grátis de 10 mil verificações por mês).
//   3) Colocar a chave abaixo e publicar. Acompanhar em App Check › APIs › Cloud Firestore se as
//      solicitações aparecem como "verificadas". Só depois de alguns dias, apertar "Aplicar" (enforce).
export const CHAVE_SITE = '';
