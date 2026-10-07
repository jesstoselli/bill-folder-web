import { TestBed } from '@angular/core/testing';
import { MoneyComponent } from './money.component';

describe('MoneyComponent', () => {
  it('formats BRL values with tabular numeric semantics', () => {
    const fixture = TestBed.createComponent(MoneyComponent);
    fixture.componentRef.setInput('value', 1234.5);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const value = root.querySelector<HTMLElement>('data');

    expect(value?.textContent).toContain('1.234,50');
    expect(value?.getAttribute('value')).toBe('1234.5');
  });
});
