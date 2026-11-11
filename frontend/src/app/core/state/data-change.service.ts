import { Injectable, signal } from '@angular/core';

/**
 * Notificação central de mutações (evento criado/editado/cancelado/pago, aprovação
 * decidida). Telas leem `version` para invalidar dados derivados — resumo financeiro e
 * contador de convites — sem polling de rede.
 */
@Injectable({ providedIn: 'root' })
export class DataChangeService {
  private readonly versionSignal = signal(0);
  readonly version = this.versionSignal.asReadonly();

  notify(): void {
    this.versionSignal.update(value => value + 1);
  }
}
