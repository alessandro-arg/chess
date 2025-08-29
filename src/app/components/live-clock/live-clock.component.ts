import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-live-clock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-clock.component.html',
  styleUrl: './live-clock.component.css',
})
export class LiveClockComponent {
  now = signal(new Date());
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const id = window.setInterval(() => this.now.set(new Date()), 30_000);
      this.destroyRef.onDestroy(() => clearInterval(id));
    }
  }
}
