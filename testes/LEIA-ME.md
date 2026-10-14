# Testes automáticos

Rodam sozinhos no GitHub (workflow **Testes automáticos**) em toda proposta de mudança e antes de cada publicação.

- `regras.test.mjs`: regras de segurança do Firestore, perfil por perfil (quem lê e quem altera cada coleção).
- `rotinas.test.mjs`: rotinas de `integracao/admin` (dados de importação, administrador, cópia de segurança e restauração).

Para rodar num computador (precisa de Node 20 e Java 21):

```
npm install --prefix integracao/admin
cd testes
npm install
npm run emulador
```

Os testes usam um projeto de teste (`demo-dikma`) no emulador local; não tocam no banco de verdade.
