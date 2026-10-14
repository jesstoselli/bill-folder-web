import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { SessionEndRedirect } from '../../core/auth/session-end-redirect';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { ConfirmActionDialogComponent } from '../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { AccountPage } from './account.page';

describe('AccountPage', () => {
  it('shows who is signed in with the avatar initial', async () => {
    const { element } = await setup();

    expect(element.querySelector('.account-page__avatar')?.textContent?.trim()).toBe('J');
    expect(element.textContent).toContain('Jess');
    expect(element.textContent).toContain('jess@example.com');
  });

  it('switches the appearance through the theme service', async () => {
    const { element, theme } = await setup();

    const light = [...element.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')].find(
      (button) => button.textContent?.includes('Claro'),
    );
    light?.click();

    expect(theme.setMode).toHaveBeenCalledWith('light');
  });

  it('signs out only after confirmation and reloads once the request settles', async () => {
    const { element, dialog, confirmation, session, logout, redirect } = await setup();

    findButton(element, 'Sair da conta').click();
    const [component, config] = dialog.open.mock.calls[0] as unknown as [
      unknown,
      { data: { confirmLabel: string } },
    ];
    expect(component).toBe(ConfirmActionDialogComponent);
    expect(config.data.confirmLabel).toBe('Sair');
    expect(session.logout).not.toHaveBeenCalled();

    confirmation.next(true);
    expect(session.logout).toHaveBeenCalledOnce();
    expect(redirect.toLogin).not.toHaveBeenCalled();

    logout.next();
    logout.complete();
    expect(redirect.toLogin).toHaveBeenCalledOnce();
  });

  it('keeps the session when the confirmation is dismissed', async () => {
    const { element, confirmation, session } = await setup();

    findButton(element, 'Sair da conta').click();
    confirmation.next(false);

    expect(session.logout).not.toHaveBeenCalled();
  });
});

async function setup() {
  const confirmation = new Subject<boolean | undefined>();
  const logout = new Subject<void>();
  const dialog = { open: vi.fn(() => ({ afterClosed: () => confirmation.asObservable() })) };
  const session = {
    user: signal({ id: 'user-1', email: 'jess@example.com', displayName: 'Jess' }).asReadonly(),
    logout: vi.fn(() => logout.asObservable()),
  };
  const redirect = { toLogin: vi.fn() };
  const theme = {
    mode: signal<ThemeMode>('system').asReadonly(),
    setMode: vi.fn(),
  };
  await TestBed.configureTestingModule({
    imports: [AccountPage],
    providers: [
      { provide: AuthSessionService, useValue: session },
      { provide: SessionEndRedirect, useValue: redirect },
      { provide: ThemeService, useValue: theme },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  TestBed.overrideProvider(MatDialog, { useValue: dialog });
  await TestBed.compileComponents();
  const fixture = TestBed.createComponent(AccountPage);
  fixture.detectChanges();
  return {
    element: fixture.nativeElement as HTMLElement,
    dialog,
    confirmation,
    session,
    logout,
    redirect,
    theme,
  };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}
