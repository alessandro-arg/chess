import {
  Component,
  EventEmitter,
  Input,
  Output,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';

type ShareTarget = 'copy' | 'facebook' | 'linkedin' | 'twitter' | 'whatsapp';

@Component({
  selector: 'app-share-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './share-menu.component.html',
  styleUrl: './share-menu.component.css',
})
export class ShareMenuComponent {
  @Input() url = window?.location?.href ?? '';
  @Input() title = 'Check this out';
  @Output() close = new EventEmitter<void>();

  get safeAreaPadding() {
    return 'max(env(safe-area-inset-bottom), 0px)';
  }

  actions = [
    {
      key: 'facebook' as ShareTarget,
      label: 'Facebook',
      icon: '../../../assets/fb.png',
    },
    {
      key: 'linkedin' as ShareTarget,
      label: 'LinkedIn',
      icon: '../../../assets/linkedin.png',
    },
    {
      key: 'twitter' as ShareTarget,
      label: 'X (Twitter)',
      icon: '../../../assets/twitter.png',
    },
    {
      key: 'whatsapp' as ShareTarget,
      label: 'WhatsApp',
      icon: '../../../assets/whatsapp.png',
    },
  ];

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.close.emit();
  }

  onBackdrop(e: MouseEvent) {
    e.stopPropagation();
    this.close.emit();
  }

  async handle(target: ShareTarget) {
    const url = encodeURIComponent(this.url);
    const text = encodeURIComponent(this.title + ' ' + this.url);
    const title = encodeURIComponent(this.title);

    switch (target) {
      case 'copy':
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(this.url);
          } else {
            this.fallbackCopy(this.url);
          }
          this.toast('Link copied ✔');
        } catch {
          this.fallbackCopy(this.url);
          this.toast('Link copied ✔');
        }
        break;
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${url}`,
          '_blank',
          'noopener'
        );
        break;
      case 'linkedin':
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
          '_blank',
          'noopener'
        );
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${text}`,
          '_blank',
          'noopener'
        );
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
        break;
    }
  }

  private fallbackCopy(value: string) {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(ta);
  }

  // Minimal toast (non-blocking)
  private toast(msg: string) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.className =
      'fixed left-1/2 -translate-x-1/2 bottom-[calc(24px+env(safe-area-inset-bottom))] z-[1000] ' +
      'px-4 py-2 rounded-xl bg-steel-primary/90 text-white text-sm shadow-lg border border-steel-primary/30';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  // --- SVG icons (kept inline so you don't need extra assets) ---
  private get svgClipboard() {
    return `
    <svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
      <path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M9 6h6m-7 3h8m-9 3h10M8 6a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2H10a2 2 0 01-2-2z'/>
    </svg>`;
  }
  private get svgFacebook() {
    return `
    <svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
      <path d='M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.21 10.44 22v-7.01H7.9v-2.93h2.54V9.41c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.93h-2.34V22C18.34 21.21 22 17.08 22 12.06z'/>
    </svg>`;
  }
  private get svgLinkedIn() {
    return `
    <svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
      <path d='M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V24h-4V8zM8.5 8h3.8v2.2h.05c.53-1 1.83-2.2 3.77-2.2 4.03 0 4.78 2.65 4.78 6.1V24h-4v-7.1c0-1.7-.03-3.88-2.37-3.88-2.38 0-2.75 1.86-2.75 3.77V24h-4V8z'/>
    </svg>`;
  }
  private get svgTwitter() {
    return `
    <svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
      <path d='M22.46 6c-.77.35-1.6.58-2.46.69a4.23 4.23 0 001.86-2.33 8.47 8.47 0 01-2.68 1.03 4.22 4.22 0 00-7.19 3.85A12 12 0 013 4.9a4.22 4.22 0 001.31 5.64 4.17 4.17 0 01-1.91-.53v.05a4.22 4.22 0 003.38 4.13 4.25 4.25 0 01-1.9.07 4.22 4.22 0 003.94 2.93A8.47 8.47 0 012 19.54 12 12 0 008.29 21c7.55 0 11.68-6.26 11.68-11.68l-.01-.53A8.36 8.36 0 0022.46 6z'/>
    </svg>`;
  }
  private get svgWhatsApp() {
    return `
    <svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
      <path d='M20.52 3.48A11.92 11.92 0 0012.04 0C5.45 0 .11 5.35.11 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.64a11.87 11.87 0 005.74 1.47h.01c6.59 0 11.93-5.35 11.93-11.94 0-3.19-1.24-6.19-3.46-8.41zM12.05 21.4h-.01a9.43 9.43 0 01-4.81-1.31l-.35-.2-3.74.98 1-3.65-.24-.37a9.43 9.43 0 01-1.46-5.02c0-5.2 4.23-9.43 9.44-9.43a9.4 9.4 0 019.43 9.43c0 5.21-4.23 9.44-9.44 9.44zm5.47-7.08c-.3-.15-1.77-.88-2.04-.98-.27-.1-.47-.15-.67.15s-.77.98-.95 1.18c-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.88-.78-1.47-1.74-1.64-2.04-.17-.3-.02-.47.13-.62.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.18-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.48 1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.11.57-.08 1.77-.72 2.02-1.41.25-.7.25-1.3.17-1.41-.07-.1-.27-.17-.57-.32z'/>
    </svg>`;
  }
  private get svgTelegram() {
    return `
    <svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
      <path d='M22.999 3.5a1.5 1.5 0 00-2.078-1.393L2.61 9.663a1 1 0 00.064 1.883l5.65 1.883 2.095 6.81a1 1 0 001.806.246l2.99-4.816 5.23 3.993a1 1 0 001.57-.62L23 3.5z'/>
    </svg>`;
  }
  private get svgEmail() {
    return `
    <svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
      <path d='M2 5a2 2 0 012-2h16a2 2 0 012 2v.4l-10 6.25L2 5.4V5zm0 2.84V19a2 2 0 002 2h16a2 2 0 002-2V7.84l-9.35 5.83a2 2 0 01-2.3 0L2 7.84z'/>
    </svg>`;
  }
}
