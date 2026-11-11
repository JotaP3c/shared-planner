import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('shared-planner-frontend');
  // Instancia o tema na raiz para aplicar a preferência salva em qualquer rota (inclusive /login).
  private readonly theme = inject(ThemeService);
}
