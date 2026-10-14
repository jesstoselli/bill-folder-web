import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../theme/theme.service';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders grouped operational and admin destinations with Home active', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('activeRoute', '/home');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('nav a'));
    const sectionLabels = Array.from(
      root.querySelectorAll<HTMLElement>('.sidebar__section-label'),
    ).map((label) => label.textContent?.trim());
    const linkLabels = links.map((link) => link.textContent?.trim());

    expect(sectionLabels).toEqual(['Principal', 'Gerenciar']);
    expect(linkLabels).toEqual([
      'Home',
      'Despesas',
      'Despesas avulsas',
      'Recebimentos',
      'Despesas no cartão',
      'Poupança',
      'Ajustes',
      'Ciclos',
      'Bancos',
      'Cartões',
      'Poupanças',
    ]);
    expect(linkLabels).toContain('Ciclos');
    expect(linkLabels).toContain('Bancos');
    expect(links.find((link) => link.textContent?.includes('Ciclos'))?.getAttribute('href')).toBe(
      '/gerenciar/ciclos',
    );
    expect(links.find((link) => link.textContent?.includes('Bancos'))?.getAttribute('href')).toBe(
      '/gerenciar/contas',
    );
    expect(root.querySelector<HTMLElement>('[aria-current="page"]')?.textContent).toContain('Home');
  });

  it('uses the wordmark with a dark "folder" in the light theme', () => {
    TestBed.overrideProvider(ThemeService, { useValue: { isDark: () => false } });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    const logo = (fixture.nativeElement as HTMLElement).querySelector('.sidebar__brand-logo');
    expect(logo?.getAttribute('src')).toBe('/brand/billfolder-wordmark-light.svg');
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

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('nav a'));

    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Home',
      'Despesas',
      'Despesas avulsas',
      'Recebimentos',
      'Despesas no cartão',
      'Poupança',
      'Ajustes',
      'Ciclos',
      'Bancos',
      'Cartões',
      'Poupanças',
    ]);
    expect(
      Array.from(root.querySelectorAll<HTMLElement>('.sidebar__section-label')).every((label) =>
        label.classList.contains('u-visually-hidden'),
      ),
    ).toBe(true);
    const account = root.querySelector<HTMLAnchorElement>('a[aria-label="Sua conta"]');
    expect(account?.getAttribute('href')).toBe('/conta');
    const symbol = root.querySelector<HTMLImageElement>('.sidebar__brand-symbol');
    expect(symbol?.getAttribute('src')).toBe('/brand/billfolder-symbol.svg');
    expect(symbol?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses the same Material Filled icons as the Android drawer', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('nav a'));

    expect(links.map((link) => link.querySelector('app-icon')?.getAttribute('data-icon'))).toEqual([
      'home',
      'receiptLong',
      'shoppingBag',
      'attachMoney',
      'creditCard',
      'savings',
      'tune',
      'calendarMonth',
      'accountBalance',
      'creditCard',
      'savings',
    ]);
    const iconNames = links.map((link) =>
      link.querySelector('app-icon')?.getAttribute('data-icon'),
    );
    expect(iconNames).toContain('calendarMonth');
    expect(iconNames).toContain('accountBalance');
  });

  it('shows the signed-in user and links to Sua conta in the footer', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('user', { displayName: 'jess', email: 'jess@example.com' });
    fixture.componentRef.setInput('activeRoute', '/conta');
    fixture.detectChanges();
    const account = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.sidebar__footer a',
    );

    expect(account?.getAttribute('href')).toBe('/conta');
    expect(account?.querySelector('.sidebar__avatar')?.textContent?.trim()).toBe('J');
    expect(account?.textContent).toContain('jess');
    expect(account?.getAttribute('aria-current')).toBe('page');
  });
});
