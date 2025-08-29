import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastMessageComponent } from './components/toast-message/toast-message.component';
import { eligibleForA2HS, hasSeenA2HS, markA2HSSeen } from './a2hs.util';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ToastMessageComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'Chess²';
  isAuthenticated$: Observable<boolean> = this.auth.isAuthenticated$;
  showA2HS = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit() {
    if (eligibleForA2HS() && !hasSeenA2HS()) {
      this.showA2HS = true;
      markA2HSSeen();
    }
  }

  closeA2HS() {
    this.showA2HS = false;
  }

  logout(): void {
    this.auth.logout().then(() => this.router.navigateByUrl('/login'));
  }
}
