# Frontend standalone

O artefato implantável vive em `C:\git\shared-planner-frontend`. O build usa Node 24, `npm ci` e Angular SSR; o runtime serve `server.mjs` como usuário sem privilégios na porta interna `4000`.

## Teste e build independentes

```powershell
cd C:\git\shared-planner-frontend
npm.cmd ci
npm.cmd test -- --watch=false
npm.cmd run build
docker build -t shared-planner-frontend .
```

## Comunicação com o backend

No Compose, `BACKEND_URL=http://backend:8080` habilita o proxy SSR de `/api`. O navegador usa a mesma origem do frontend e não precisa conhecer o DNS privado do Docker. Fora do Docker, `npm start` usa `proxy.conf.json` e encaminha para `localhost:8080`.

```powershell
cd C:\git\shared-planner
docker compose logs -f frontend
```
