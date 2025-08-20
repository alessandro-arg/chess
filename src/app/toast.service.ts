import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  durationMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();
  private nextId = 1;

  show(
    kind: ToastKind,
    message: string,
    title?: string,
    durationMs = 4000
  ): void {
    const toast: ToastMessage = {
      id: this.nextId++,
      kind,
      message,
      title,
      durationMs,
    };
    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(message: string, title?: string, durationMs?: number): void {
    this.show('success', message, title, durationMs);
  }

  error(message: string, title?: string, durationMs?: number): void {
    this.show('error', message, title, durationMs);
  }

  info(message: string, title?: string, durationMs?: number): void {
    this.show('info', message, title, durationMs);
  }

  dismiss(id: number): void {
    this.toastsSubject.next(
      this.toastsSubject.value.filter((t) => t.id !== id)
    );
  }
}
