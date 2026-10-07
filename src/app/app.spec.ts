import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { AuthSessionService } from './core/auth/auth-session.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: AuthSessionService,
          useValue: {
            isAuthenticated: () => true,
            logout: () => of(void 0),
          },
        },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () =>
              of({
                matches: true,
                breakpoints: {
                  '(min-width: 1200px)': true,
                  '(min-width: 768px) and (max-width: 1199.98px)': false,
                  '(max-width: 767.98px)': false,
                },
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders only the permitted root elements', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const directChildren = Array.from(root.children);

    expect(directChildren).toHaveLength(2);
    expect(directChildren[0]?.matches('a.skip-link')).toBe(true);
    expect(directChildren[1]?.matches('router-outlet')).toBe(true);
  });

  it('connects the skip link to the unique focusable main landmark rendered by the shell', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/home');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const skipLink = root.querySelector(':scope > a.skip-link');
    const routingHost = root.querySelector(':scope > router-outlet');
    const targets = root.querySelectorAll<HTMLElement>('#main-content');
    const mainTarget = targets.item(0);

    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(skipLink?.getAttribute('aria-label')).toBe('Pular para o conteúdo');
    expect(skipLink?.textContent?.trim()).toBe('Pular para o conteúdo');
    expect(targets).toHaveLength(1);
    expect(mainTarget.tagName).toBe('MAIN');
    expect(mainTarget.getAttribute('tabindex')).toBe('-1');
    expect(routingHost?.hasAttribute('id')).toBe(false);
    expect(routingHost?.hasAttribute('tabindex')).toBe(false);

    mainTarget.focus();
    expect(document.activeElement).toBe(mainTarget);
  });

  it('moves focus to the main landmark when the skip link is activated', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/home');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const skipLink = root.querySelector<HTMLAnchorElement>(':scope > a.skip-link');
    const mainTarget = root.querySelector<HTMLElement>('main#main-content');

    skipLink?.focus();
    expect(document.activeElement).toBe(skipLink);

    skipLink?.click();

    expect(document.activeElement).toBe(mainTarget);
  });
});
