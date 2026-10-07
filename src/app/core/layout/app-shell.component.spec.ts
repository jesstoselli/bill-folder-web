import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppShellComponent } from './app-shell.component';
import { ShellStore } from './shell.store';

describe('AppShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([]),
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

  it('keeps the primary navigation beside the routed content', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-sidebar')).not.toBeNull();
    expect(root.querySelector('main router-outlet')).not.toBeNull();
  });

  it('exposes the drawer state on the mobile menu control', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    const store = TestBed.inject(ShellStore);
    store.setMode('drawer');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const menuButton = root.querySelector<HTMLButtonElement>(
      '[aria-controls="primary-navigation"]',
    );

    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');

    menuButton?.click();
    fixture.detectChanges();

    expect(menuButton?.getAttribute('aria-expanded')).toBe('true');
  });
});
