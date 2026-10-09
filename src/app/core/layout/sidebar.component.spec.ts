import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders every MVP destination with Home active', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('activeRoute', '/home');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a'));

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Home',
      'Despesas',
      'Despesas avulsas',
      'Recebimentos',
      'Cartões',
      'Poupança',
      'Ajustes',
    ]);
    expect(root.querySelector<HTMLElement>('[aria-current="page"]')?.textContent).toContain('Home');
  });

  it('uses the official BillFolder wordmark when expanded', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const logo = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>(
      '.sidebar__brand-logo',
    );

    expect(logo?.getAttribute('src')).toBe('/brand/billfolder-wordmark.svg');
    expect(logo?.getAttribute('alt')).toBe('BillFolder');
  });

  it('keeps every destination programmatically named in rail mode', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('mode', 'rail');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a'));

    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Home',
      'Despesas',
      'Despesas avulsas',
      'Recebimentos',
      'Cartões',
      'Poupança',
      'Ajustes',
    ]);
    const logout = root.querySelector<HTMLButtonElement>('button[aria-label="Sair"]');
    expect(logout).not.toBeNull();
    expect(logout?.textContent?.trim()).toBe('Sair');
    const symbol = root.querySelector<HTMLImageElement>('.sidebar__brand-symbol');
    expect(symbol?.getAttribute('src')).toBe('/brand/billfolder-symbol.svg');
    expect(symbol?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses the same Material Filled icons as the Android drawer', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a'));

    expect(links.map((link) => link.querySelector('app-icon')?.getAttribute('data-icon'))).toEqual([
      'home',
      'receiptLong',
      'shoppingBag',
      'attachMoney',
      'creditCard',
      'savings',
      'tune',
    ]);
  });

  it('emits logout from a keyboard-operable button', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    let requested = false;
    fixture.componentInstance.logoutRequested.subscribe(() => (requested = true));
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Sair"]',
    );
    button?.click();

    expect(button?.type).toBe('button');
    expect(requested).toBe(true);
  });
});
