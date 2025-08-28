import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';

export type Promotion = 'q' | 'r' | 'b' | 'n';

@Component({
  selector: 'app-promotion-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './promotion-modal.component.html',
})
export class PromotionModalComponent {
  @Input() open = false;
  @Input() color: 'w' | 'b' = 'w';

  @Output() select = new EventEmitter<Promotion>();
  @Output() cancel = new EventEmitter<void>();

  choose(p: Promotion) {
    this.select.emit(p);
  }
  onBackdrop() {
    this.cancel.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open) this.cancel.emit();
  }
}
