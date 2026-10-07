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
      'Gastos diários',
      'Receitas',
      'Cartões',
      'Poupança',
      'Ajustes',
    ]);
    expect(root.querySelector<HTMLElement>('[aria-current="page"]')?.textContent).toContain('Home');
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
      'Gastos diários',
      'Receitas',
      'Cartões',
      'Poupança',
      'Ajustes',
    ]);
  });
});
