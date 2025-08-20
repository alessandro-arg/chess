import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../toast.service';

@Component({
  selector: 'app-toast-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-message.component.html',
  styleUrl: './toast-message.component.css',
})
export class ToastMessageComponent {
  toasts: ToastMessage[] = [];
  constructor(private readonly toast: ToastService) {
    this.toast.toasts$.subscribe((t) => (this.toasts = t));
    if (typeof window !== 'undefined') {
      window.addEventListener('app-toast', (e: any) => {
        const { kind, message, title } = e.detail || {};
        if (kind && message) {
          this.toast.show(kind, message, title);
        }
      });
    }
  }
  dismiss(id: number) {
    this.toast.dismiss(id);
  }
  icon(t: ToastMessage) {
    switch (t.kind) {
      case 'success':
        return '✓';
      case 'error':
        return '!';
      default:
        return 'i';
    }
  }
  iconBg(t: ToastMessage) {
    switch (t.kind) {
      case 'success':
        return 'bg-green-600/60';
      case 'error':
        return 'bg-red-600/60';
      default:
        return 'bg-blue-600/60';
    }
  }
}
