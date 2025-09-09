import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import type { AnimationItem } from 'lottie-web';

export function playerFactory() {
  return import('lottie-web');
}

@Component({
  selector: 'app-start-animation',
  standalone: true,
  imports: [CommonModule, LottieComponent],
  templateUrl: './start-animation.component.html',
  styleUrl: './start-animation.component.css',
})
export class StartAnimationComponent implements OnDestroy {
  @Output() done = new EventEmitter<void>();
  showTitle = false;
  closing = false;

  private timeouts: number[] = [];

  options: AnimationOptions = {
    path: 'assets/animations/chess-horse.json',
    loop: false,
    autoplay: true,
    renderer: 'svg',
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid meet',
      progressiveLoad: true,
    },
  };

  onCreated(item: AnimationItem) {
    const TOTAL = 3000;
    const TITLE_IN_DELAY = 500;
    const OUTRO_DURATION = 400;
    try {
      const lottieMs = (item.getDuration(true) || 1) * 2000;
      const targetMs = TOTAL - 800;
      const speed = Math.max(0.5, Math.min(2.0, lottieMs / targetMs));
      item.setSpeed(speed);
    } catch {
      item.setSpeed(1.0);
    }
    this.enqueue(() => (this.showTitle = true), TITLE_IN_DELAY);
    this.enqueue(() => (this.closing = true), TOTAL - OUTRO_DURATION);
    this.enqueue(() => this.done.emit(), TOTAL);
  }

  ngOnDestroy(): void {
    this.timeouts.forEach((t) => clearTimeout(t));
  }

  private enqueue(fn: () => void, delay: number) {
    const id = window.setTimeout(fn, delay);
    this.timeouts.push(id);
  }
}
