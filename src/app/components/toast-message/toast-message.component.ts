import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../..//toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-message.component.html',
  styleUrl: './toast-message.component.css',
})
export class ToastMessageComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  private subscription?: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.subscription = this.toastService.toasts$.subscribe((toasts) => {
      this.toasts = toasts;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  trackByToastId(index: number, toast: ToastMessage): number {
    return toast.id;
  }

  getToastClasses(toast: ToastMessage): string {
    const baseClasses =
      'p-4 rounded-xl backdrop-blur-lg border-l-4 relative overflow-hidden';

    switch (toast.kind) {
      case 'success':
        return `${baseClasses} toast-success`;
      case 'error':
        return `${baseClasses} toast-error`;
      case 'info':
        return `${baseClasses} toast-info`;
      default:
        return `${baseClasses} toast-info`;
    }
  }

  getIconClasses(kind: ToastMessage['kind']): string {
    switch (kind) {
      case 'success':
        return 'bg-green-500/20 text-green-400';
      case 'error':
        return 'bg-red-500/20 text-red-400';
      case 'info':
        return 'bg-orange-500/20 text-orange-400';
      default:
        return 'bg-steel-accent/20 text-steel-accent';
    }
  }

  getProgressBarClasses(kind: ToastMessage['kind']): string {
    switch (kind) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'info':
        return 'bg-orange-500';
      default:
        return 'bg-steel-accent';
    }
  }

  getToastIcon(kind: ToastMessage['kind']): string {
    switch (kind) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
        return 'i';
      default:
        return 'i';
    }
  }

  dismissToast(id: number): void {
    this.toastService.dismiss(id);
  }

  // dismiss(id: number) {
  //   this.toast.dismiss(id);
  // }

  // icon(t: ToastMessage) {
  //   switch (t.kind) {
  //     case 'success':
  //       return '✓';
  //     case 'error':
  //       return '!';
  //     default:
  //       return 'i';
  //   }
  // }

  // iconBg(t: ToastMessage) {
  //   switch (t.kind) {
  //     case 'success':
  //       return 'bg-green-600/60';
  //     case 'error':
  //       return 'bg-red-600/60';
  //     default:
  //       return 'bg-blue-600/60';
  //   }
  // }
}
