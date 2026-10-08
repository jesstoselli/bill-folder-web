import { TestBed } from '@angular/core/testing';
import { HomeTabsComponent } from './home-tabs.component';

describe('HomeTabsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HomeTabsComponent] }).compileComponents();
  });

  it('exposes overdue count as a badge and the active tab semantically', () => {
    const fixture = TestBed.createComponent(HomeTabsComponent);
    fixture.componentRef.setInput('selected', 'upcoming');
    fixture.componentRef.setInput('overdueCount', 3);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[role="tablist"]')).not.toBeNull();
    expect(root.querySelector('[data-tab="upcoming"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('.home-tabs__badge')?.textContent?.trim()).toBe('3');
    expect(root.querySelector('.home-tabs__badge')?.getAttribute('aria-label')).toBe(
      '3 contas atrasadas',
    );
  });

  it('moves focus and selection with arrow keys', () => {
    const fixture = TestBed.createComponent(HomeTabsComponent);
    const selected = vi.fn();
    fixture.componentRef.setInput('selected', 'upcoming');
    fixture.componentRef.instance.selectedChange.subscribe(selected);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const upcoming = root.querySelector<HTMLButtonElement>('[data-tab="upcoming"]');
    const recent = root.querySelector<HTMLButtonElement>('[data-tab="recent"]');

    upcoming?.focus();
    upcoming?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(selected).toHaveBeenCalledWith('recent');
    expect(document.activeElement).toBe(recent);
  });
});
