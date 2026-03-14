import { Component, EventEmitter, Output, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidatorFn,
} from '@angular/forms';

type Step = 'email' | 'otp' | 'newPassword' | 'success';

// ── Validators defined OUTSIDE the class as standalone functions ──────────────
// This is required — Angular validators cannot be regular class methods

const strongPasswordValidator: ValidatorFn = (control: AbstractControl) => {
  const value = control.value || '';
  const hasUpper  = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
  if (!hasUpper || !hasNumber || !hasSymbol) {
    return { weakPassword: true };
  }
  return null;
};

const passwordMatchValidator: ValidatorFn = (group: AbstractControl) => {
  const pw  = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  return pw === cpw ? null : { mismatch: true };
};

@Component({
  selector: 'app-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password-modal.component.html',
  styleUrl: './forgot-password-modal.component.css',
})
export class ForgotPasswordModalComponent {
  @Output() closeModal = new EventEmitter<void>();

  private fb   = inject(FormBuilder);
  private zone = inject(NgZone);

  currentStep: Step   = 'email';
  isLoading           = false;
  submittedEmail      = '';
  showNewPassword     = false;
  resendCountdown     = 40;
  resendInterval: any = null;
  otpDigits           = ['', '', '', '', ''];

  // ── Forms ──────────────────────────────────────────────────────────────────

  emailForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  newPasswordForm: FormGroup = this.fb.group(
    {
      password:        ['', [Validators.required, Validators.minLength(8), strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  // ── Getters ────────────────────────────────────────────────────────────────

  get email()           { return this.emailForm.get('email');                    }
  get newPassword()     { return this.newPasswordForm.get('password');           }
  get confirmPassword() { return this.newPasswordForm.get('confirmPassword');    }
  get otpValue()        { return this.otpDigits.join('');                        }
  get otpComplete()     { return this.otpDigits.every(d => d !== '');            }

  // ── Step 1: Submit email ───────────────────────────────────────────────────

  onSubmitEmail(): void {
    this.emailForm.markAllAsTouched();
    if (this.emailForm.invalid) return;

    this.submittedEmail = this.emailForm.value.email.trim();
    console.log('[ForgotPassword] Sending OTP to:', this.submittedEmail);

    // ✅ Direct assignment — no setTimeout, no delay
    // Change detection runs immediately inside NgZone
    this.zone.run(() => {
      this.currentStep = 'otp';
      this.startResendCountdown();
    });
  }

  // ── Step 2: OTP input handling ─────────────────────────────────────────────

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);

    // ✅ Create a new array reference so Angular detects the change
    const updated = [...this.otpDigits];
    updated[index] = value;
    this.otpDigits = updated;
    input.value    = value;

    if (value && index < 4) {
      setTimeout(() => {
        const next = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
        next?.focus();
      }, 0);
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      const updated  = [...this.otpDigits];
      updated[index] = '';
      this.otpDigits = updated;
      setTimeout(() => {
        const prev = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
        prev?.focus();
      }, 0);
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 5) || '';
    const updated = ['', '', '', '', ''];
    pasted.split('').forEach((char, i) => { if (i < 5) updated[i] = char; });
    this.otpDigits = updated;
  }

  onVerifyOtp(): void {
    if (!this.otpComplete) return;
    console.log('[ForgotPassword] Verifying OTP:', this.otpValue);

    // ✅ Direct assignment — no setTimeout
    this.zone.run(() => {
      this.currentStep = 'newPassword';
      this.stopResendCountdown();
    });
  }

  onResendOtp(): void {
    if (this.resendCountdown > 0) return;
    this.otpDigits       = ['', '', '', '', ''];
    this.resendCountdown = 40;
    this.startResendCountdown();
    console.log('[ForgotPassword] Resending OTP to:', this.submittedEmail);
  }

  private startResendCountdown(): void {
    this.stopResendCountdown();
    this.resendInterval = setInterval(() => {
      this.zone.run(() => {
        if (this.resendCountdown > 0) {
          this.resendCountdown--;
        } else {
          this.stopResendCountdown();
        }
      });
    }, 1000);
  }

  private stopResendCountdown(): void {
    if (this.resendInterval) {
      clearInterval(this.resendInterval);
      this.resendInterval = null;
    }
  }

  // ── Step 3: Set new password ───────────────────────────────────────────────

  onSubmitNewPassword(): void {
    this.newPasswordForm.markAllAsTouched();
    if (this.newPasswordForm.invalid) return;

    console.log('[ForgotPassword] Setting new password for:', this.submittedEmail);

    // ✅ Direct assignment — no setTimeout
    this.zone.run(() => {
      this.currentStep = 'success';
    });
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  goBack(): void {
    const steps: Step[] = ['email', 'otp', 'newPassword', 'success'];
    const idx = steps.indexOf(this.currentStep);
    if (idx > 0) {
      this.currentStep = steps[idx - 1];
    } else {
      this.onClose();
    }
  }

  onClose(): void {
    this.stopResendCountdown();
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onClose();
    }
  }
}