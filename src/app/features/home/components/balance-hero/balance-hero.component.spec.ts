import { TestBed } from '@angular/core/testing';
import { homeFixture } from '../../home.fixtures';
import { BalanceHeroComponent } from './balance-hero.component';

describe('BalanceHeroComponent', () => {
  it('presents remaining and realized totals as financial values', () => {
    const fixture = TestBed.createComponent(BalanceHeroComponent);
    fixture.componentRef.setInput('balance', homeFixture.balance);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.balance-hero__amount data')?.getAttribute('value')).toBe('2650');
    expect(root.querySelector('.balance-hero__realized data')?.getAttribute('value')).toBe('2450');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Saldo disponível');
  });
});
