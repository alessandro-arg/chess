import { Component, EventEmitter, Output } from '@angular/core';
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
export class StartAnimationComponent {
  @Output() done = new EventEmitter<void>();

  options: AnimationOptions = {
    path: 'assets/animations/chess-splash.json',
    loop: false,
    autoplay: true,
    renderer: 'svg',
  };

  onCreated(item: AnimationItem) {
    const finish = () => this.done.emit();
    item.addEventListener('complete', finish);
    setTimeout(finish, 2000);
  }
}
