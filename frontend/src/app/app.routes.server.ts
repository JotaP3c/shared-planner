import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Página pública: pode ser pré-renderizada.
  {
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  // Rotas autenticadas dependem do token em localStorage (inexistente no servidor).
  // Pré-renderizá-las gerava um <meta refresh> fixo para /login, expulsando usuários logados
  // em F5/URL direta. Renderizadas no cliente, o authGuard decide com a sessão real.
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
