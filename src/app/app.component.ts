import { Component, OnInit } from '@angular/core';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Observable, take } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastMessageComponent } from './components/toast-message/toast-message.component';
import { eligibleForA2HS, hasSeenA2HS, markA2HSSeen } from './a2hs.util';
import { StartIntroService } from './start-intro.service';
import { StartAnimationComponent } from './components/start-animation/start-animation.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ToastMessageComponent,
    StartAnimationComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'Chess²';
  isAuthenticated$: Observable<boolean> = this.auth.isAuthenticated$;
  showA2HS = false;
  showIntro = false;
  booting = true;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly intro: StartIntroService
  ) {}

  ngOnInit() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        take(1)
      )
      .subscribe(() => {
        const onLogin = this.router.url.startsWith('/login');
        const firstTime = !this.intro.hasSeen();

        this.isAuthenticated$.pipe(take(1)).subscribe((isAuthed) => {
          this.showIntro = !isAuthed && onLogin && firstTime;
          this.booting = false;
        });
      });

    if (eligibleForA2HS() && !hasSeenA2HS()) {
      this.showA2HS = true;
      markA2HSSeen();
    }

    this.router.events
      .pipe(filter((e: any) => e instanceof NavigationStart))
      .subscribe(() => {
        if (this.showIntro) this.onIntroDone();
      });
  }

  onIntroDone() {
    this.intro.markSeen();
    this.showIntro = false;
  }

  closeA2HS() {
    this.showA2HS = false;
  }

  logout(): void {
    this.auth.logout().then(() => this.router.navigateByUrl('/login'));
  }
}
