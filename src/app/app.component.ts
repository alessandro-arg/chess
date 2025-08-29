import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastMessageComponent } from './components/toast-message/toast-message.component';
import { shouldShowA2HS } from './a2hs.util';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ToastMessageComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Chess²';
  isAuthenticated$: Observable<boolean> = this.auth.isAuthenticated$;
  shouldShowA2HS = shouldShowA2HS;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  logout(): void {
    this.auth.logout().then(() => this.router.navigateByUrl('/login'));
  }
}
