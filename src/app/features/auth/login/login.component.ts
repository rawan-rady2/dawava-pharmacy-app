import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ForgotPasswordModalComponent } from '../forgot-password-modal/forgot-password-modal.component';
import { ItSupportModalComponent } from '../it-support-modal/it-support-modal.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ForgotPasswordModalComponent,
    ItSupportModalComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {

  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private router      = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  showPassword            = false;
  isLoading               = false;
  errorMessage            = '';
  showForgotPasswordModal = false;
  showItSupportModal      = false;

  // SECURITY: rate limiting — minimum 2 seconds between submissions
  private lastSubmitTime      = 0;
  private readonly COOLDOWN_MS = 2000;

  svgPaths = {
    decorative:
      'M150 0 C200 50 250 100 300 150 C250 200 200 250 150 300 C100 250 50 200 0 150 C50 100 100 50 150 0Z',
    medicalBag:
      'M10 8h10v2H10V8zm-1-3a1 1 0 011-1h10a1 1 0 011 1v1H9V5zm11 2H10v13h10V7zm-8 3h2v6h-2v-6zm4 0h2v6h-2v-6z',
    shield:
      'M8 0L0 3v5c0 4.4 3.4 8.5 8 9.5C12.6 16.5 16 12.4 16 8V3L8 0z',
    lock: 'M8 0C5.8 0 4 1.8 4 4v2H2v15h12V6h-2V4c0-2.2-1.8-4-4-4zm0 2c1.1 0 2 .9 2 2v2H6V4c0-1.1.9-2 2-2zm0 9c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z',
    user: 'M6.667 6.667A3.333 3.333 0 106.667 0a3.333 3.333 0 000 6.667zm0 1.666C4.444 8.333 0 9.444 0 11.667v1.666h13.333v-1.666C13.333 9.444 8.89 8.333 6.667 8.333z',
    lockSmall:
      'M6.667 0A4.167 4.167 0 002.5 4.167V5H1.25A1.25 1.25 0 000 6.25v10A1.25 1.25 0 001.25 17.5h10A1.25 1.25 0 0012.5 16.25v-10A1.25 1.25 0 0011.25 5H10V4.167A3.333 3.333 0 006.667 0zm0 1.667A2.5 2.5 0 019.167 4.167V5H4.167V4.167A2.5 2.5 0 016.667 1.667zM6.667 9.167A1.667 1.667 0 116.666 12.5a1.667 1.667 0 010-3.333z',
    eye: 'M9.167 6.25c0 1.61-1.307 2.917-2.917 2.917A2.917 2.917 0 013.333 6.25 2.917 2.917 0 016.25 3.333 2.917 2.917 0 019.167 6.25zM6.25 0C3.417 0 1 1.667 0 4.167a6.842 6.842 0 0012.5 0C11.5 1.667 9.083 0 6.25 0z',
    arrowRight:
      'M8.333 1.667L13.333 7.5H0v.833h13.333L8.333 14.167l.584.583 5.833-6.25v-.833L8.917 1.083l-.584.584z',
  };

  private readonly BRANCH_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.authService.redirectByRole(this.authService.getRole() || '');
    }
  }

  get email()    { return this.loginForm.get('email');    }
  get password() { return this.loginForm.get('password'); }

  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }

  openForgotPasswordModal(): void  { this.showForgotPasswordModal = true;  }
  closeForgotPasswordModal(): void { this.showForgotPasswordModal = false; }
  openItSupportModal(): void       { this.showItSupportModal = true;       }
  closeItSupportModal(): void      { this.showItSupportModal = false;      }

  onSubmit(): void {
    // SECURITY: frontend rate limiting — prevents rapid repeated submissions
    const now = Date.now();
    if (now - this.lastSubmitTime < this.COOLDOWN_MS) {
      return;
    }
    this.lastSubmitTime = now;

    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;

    this.isLoading    = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    this.authService
      .loginAndRedirect({
        identifier: email.trim(),
        password:   password.trim(),
        branch_id:  this.BRANCH_ID,
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.authService.redirectByRole(res.role);
        },
        error: (err: Error) => {
          this.isLoading    = false;
          // SECURITY: display generic message from service — never raw error
          this.errorMessage = err.message;
        },
      });
  }

  onContactSupport(): void {
    this.openItSupportModal();
  }
}