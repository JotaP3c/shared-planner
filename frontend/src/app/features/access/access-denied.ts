import { Component } from '@angular/core';

@Component({
  selector: 'app-access-denied',
  template: `<section class="page"><header class="page-header"><div><span class="eyebrow">Acesso</span>
    <h1>Acesso não autorizado</h1><p>Seu perfil não permite abrir esta página. Solicite o acesso ao responsável.</p>
    </div></header></section>`,
})
export class AccessDenied {}
