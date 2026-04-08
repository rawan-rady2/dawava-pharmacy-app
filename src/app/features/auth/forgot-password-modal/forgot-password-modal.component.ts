import {
  Component, EventEmitter, Output, NgZone, inject, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup,
  Validators, ValidatorFn, AbstractControl
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

const strongPasswordValidator: ValidatorFn = (control: AbstractControl) => {
  const value = control.value || '';
  const hasUpper   = /[A-Z]/.test(value);
  const hasLower   = /[a-z]/.test(value);
  const hasNumber  = /[0-9]/.test(value);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
  const isValid    = hasUpper && hasLower && hasNumber && hasSpecial && value.length >= 8;
  return isValid ? null : { weakPassword: true };
};

const passwordMatchValidator: ValidatorFn = (group: AbstractControl) => {
  const pw      = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pw === confirm ? null : { mismatch: true };
};

type ForgotStep = 'email' | 'otp' | 'newPassword' | 'success';

@Component({
  selector:    'app-forgot-password-modal',
  standalone:  true,
  imports:     [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password-modal.component.html',
  styleUrls: ['./forgot-password-modal.component.css'],
})
export class ForgotPasswordModalComponent implements OnDestroy {
  @Output() closeModal = new EventEmitter<void>();

  private fb   = inject(FormBuilder);
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  private cdr  = inject(ChangeDetectorRef); // ← FIX #3

  currentStep: ForgotStep = 'email';
  isLoading               = false;
  errorMessage            = '';

  private submittedEmail = '';
  private resetToken     = '';

  resendCountdown  = 0;
  private countdownSub: Subscription | null = null; // ← FIX #3: RxJS instead of setInterval

  emailForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  otpForm: FormGroup = this.fb.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  passwordForm: FormGroup = this.fb.group(
    {
      newPassword:     ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  get email()           { return this.emailForm.get('email');              }
  get otp()             { return this.otpForm.get('otp');                  }
  get newPassword()     { return this.passwordForm.get('newPassword');     }
  get confirmPassword() { return this.passwordForm.get('confirmPassword'); }
  get maskedEmail()     { return this.maskEmail(this.submittedEmail);      }
  get resendCountdownDisplay(): string {
    const minutes = Math.floor(this.resendCountdown / 60);
    const seconds = this.resendCountdown % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  onSubmitEmail(): void {
    this.emailForm.markAllAsTouched();
    if (this.emailForm.invalid) return;

    this.isLoading      = true;
    this.errorMessage   = '';
    this.submittedEmail = this.emailForm.value.email.trim();

    this.http.post<any>('/api/auth/forgot-password/request-otp', {
      email: this.submittedEmail
    }).subscribe({
      next: () => {
        this.isLoading   = false;
        this.currentStep = 'otp';       // ← FIX #2: no zone.run needed, just assign
        this.startResendCountdown();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading    = false;
        this.errorMessage = this.extractError(err);
        this.cdr.markForCheck();
      },
    });
  }

  onSubmitOtp(): void {
    this.otpForm.markAllAsTouched();
    if (this.otpForm.invalid) return;

    this.isLoading    = true;
    this.errorMessage = '';

    const body = {
      email:    this.submittedEmail,
      otp_code: this.otpForm.value.otp.trim(),
    };

    this.http.post<any>('/api/auth/forgot-password/verify-otp', body)
      .subscribe({
        next: (res) => {
          this.resetToken  = res?.reset_token || res?.token || res?.data?.reset_token || '';
          this.isLoading   = false;
          this.currentStep = 'newPassword';
          this.stopCountdown();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading    = false;
          this.errorMessage = this.extractError(err);
          this.cdr.markForCheck();
        },
      });
  }

  onSubmitPassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;

    this.isLoading    = true;
    this.errorMessage = '';

    const body = {
      reset_token:  this.resetToken,
      new_password: this.passwordForm.value.newPassword,
    };

    this.http.post<any>('/api/auth/forgot-password/reset', body)
      .subscribe({
        next: () => {
          this.isLoading   = false;
          this.currentStep = 'success';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading    = false;
          this.errorMessage = this.extractError(err);
          this.cdr.markForCheck();
        },
      });
  }

  resendOtp(): void {
    if (this.resendCountdown > 0) return;

    this.isLoading    = true;
    this.errorMessage = '';

    this.http.post<any>('/api/auth/forgot-password/request-otp', {
      email: this.submittedEmail,
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.startResendCountdown();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading    = false;
        this.errorMessage = this.extractError(err);
        this.cdr.markForCheck();
      },
    });
  }

  otpDigits = ['', '', '', '', '', ''];

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    this.otpDigits[index] = value;
    this.otpForm.patchValue({ otp: this.otpDigits.join('') });
    if (value && index < 5) {
      const next = document.getElementById(`otp-box-${index + 1}`);
      next?.focus();
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      const prev = document.getElementById(`otp-box-${index - 1}`);
      prev?.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text   = event.clipboardData?.getData('text') || '';
    const digits = text.replace(/\D/g, '').slice(0, 6).split('');
    digits.forEach((d, i) => { this.otpDigits[i] = d; });
    this.otpForm.patchValue({ otp: this.otpDigits.join('') });
  }

  // ── FIX #1: removed stopPropagation — it was swallowing the emit ──────────
  close(): void {
    this.stopCountdown();
    this.isLoading    = false;
    this.errorMessage = '';
    this.currentStep  = 'email';
    this.closeModal.emit();
  }

  // ── FIX #3: RxJS interval stays inside Angular zone automatically ─────────
  private startResendCountdown(): void {
    this.stopCountdown();
    this.resendCountdown = 300;
    this.countdownSub = interval(1000)
      .pipe(take(300))
      .subscribe(() => {
        this.resendCountdown--;
        this.cdr.markForCheck();
      });
  }

  private stopCountdown(): void {
    this.countdownSub?.unsubscribe();
    this.countdownSub = null;
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  private extractError(err: any): string {
    if (err.status === 0)   return 'Unable to connect. Please check your internet connection.';
    if (err.status === 400) return err.error?.message || 'Invalid request. Please check your input.';
    if (err.status === 404) return 'No account found with this email address.';
    if (err.status === 410) return 'OTP has expired. Please request a new one.';
    if (err.status === 422) return 'Invalid or expired OTP. Please try again.';
    if (err.status === 429) return 'Too many attempts. Please wait a few minutes.';
    return 'Something went wrong. Please try again.';
  }

  private maskEmail(email: string): string {
    if (!email) return '';
    const [user, domain] = email.split('@');
    const masked = user.slice(0, 2) + '***';
    return `${masked}@${domain}`;
  }

  showNewPassword     = false;
  showConfirmPassword = false;

  toggleNewPassword():     void { this.showNewPassword     = !this.showNewPassword;     }
  toggleConfirmPassword(): void { this.showConfirmPassword = !this.showConfirmPassword; }
}