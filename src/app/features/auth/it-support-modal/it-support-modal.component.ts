import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ContactItem {
  icon: string;
  label: string;
  value: string;
  action: 'email' | 'phone' | 'text';
}

@Component({
  selector: 'app-it-support-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './it-support-modal.component.html',
  styleUrl: './it-support-modal.component.css',
})
export class ItSupportModalComponent {
  @Output() closeModal = new EventEmitter<void>();

  copiedIndex: number | null = null;

  // ── Contact details — replace placeholders with real values when available ──
  contacts: ContactItem[] = [
    {
      icon: 'email',
      label: 'Email Support',
      value: 'it-support@dawava.com',
      action: 'email',
    },
    {
      icon: 'phone',
      label: 'Phone Support',
      value: '+1 (800) 000-0000',
      action: 'phone',
    },
    {
      icon: 'hours',
      label: 'Working Hours',
      value: 'Sun – Thu, 8:00 AM – 5:00 PM',
      action: 'text',
    },
    {
      icon: 'response',
      label: 'Response Time',
      value: 'Within 2 business hours',
      action: 'text',
    },
  ];

  onAction(contact: ContactItem): void {
    if (contact.action === 'email') {
      window.location.href = `mailto:${contact.value}?subject=IT Support Request — Dawava Pharmacy`;
    } else if (contact.action === 'phone') {
      window.location.href = `tel:${contact.value.replace(/\D/g, '')}`;
    }
  }

  copyToClipboard(value: string, index: number): void {
    navigator.clipboard.writeText(value).then(() => {
      this.copiedIndex = index;
      setTimeout(() => {
        this.copiedIndex = null;
      }, 2000);
    });
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('support-backdrop')) {
      this.onClose();
    }
  }
}