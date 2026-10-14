import { Component, computed, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { SessionEndRedirect } from '../../core/auth/session-end-redirect';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ConfirmActionDialogComponent } from '../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { userInitial } from '../../shared/formatters/user-initial';

/**
 * "Sua conta", as on Android: who is signed in, this device's appearance,
 * notifications (coming with due-date reminders) and an explicit sign-out.
 */
@Component({
  selector: 'app-account-page',
  imports: [
    ButtonComponent,
    IconComponent,
    MatButtonToggleModule,
    MatDialogModule,
    PageHeaderComponent,
  ],
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
})
export class AccountPage {
  private readonly session = inject(AuthSessionService);
  private readonly sessionEndRedirect = inject(SessionEndRedirect);
  private readonly dialog = inject(MatDialog);
  protected readonly theme = inject(ThemeService);
  protected readonly user = this.session.user;
  protected readonly initial = computed(() => {
    const user = this.user();
    return user ? userInitial(user) : '';
  });
  protected readonly themeOptions: readonly { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'Automático' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Escuro' },
  ];

  protected setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected confirmLogout(): void {
    this.dialog
      .open(ConfirmActionDialogComponent, {
        data: {
          title: 'Sair da conta?',
          message: 'Você vai precisar entrar de novo para voltar ao BillFolder.',
          confirmLabel: 'Sair',
        },
        width: '28rem',
        maxWidth: 'calc(100vw - 2rem)',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        // Reload only after the logout request settles so the cookie
        // revocation is not aborted by the page unload.
        if (confirmed) this.session.logout().subscribe(() => this.sessionEndRedirect.toLogin());
      });
  }
}
