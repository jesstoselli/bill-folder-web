import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
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

  it('connects the accessible skip link to the routing host', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const skipLink = root.querySelector(':scope > a.skip-link');
    const routingHost = root.querySelector(':scope > router-outlet');

    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(skipLink?.getAttribute('aria-label')).toBe('Pular para o conteúdo');
    expect(skipLink?.textContent?.trim()).toBe('Pular para o conteúdo');
    expect(routingHost?.id).toBe('main-content');
  });
});
