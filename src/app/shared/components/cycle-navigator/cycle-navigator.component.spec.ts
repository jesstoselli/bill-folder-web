import { TestBed } from '@angular/core/testing';
import { CycleNavigatorComponent } from './cycle-navigator.component';

describe('CycleNavigatorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CycleNavigatorComponent],
    }).compileComponents();
  });

  it('shows the selected cycle without converting its civil dates', () => {
    const fixture = TestBed.createComponent(CycleNavigatorComponent);
    fixture.componentRef.setInput('label', 'Ciclo atual');
    fixture.componentRef.setInput('startDate', '2026-09-28');
    fixture.componentRef.setInput('endDate', '2026-10-27');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.cycle-navigator__label')?.textContent?.trim()).toBe('Ciclo atual');
    expect(root.querySelector('time[datetime="2026-09-28"]')?.textContent?.trim()).toBe(
      '28/09/2026',
    );
    expect(root.querySelector('time[datetime="2026-10-27"]')?.textContent?.trim()).toBe(
      '27/10/2026',
    );
  });

  it('emits enabled navigation and suppresses a disabled direction', () => {
    const fixture = TestBed.createComponent(CycleNavigatorComponent);
    const previous = vi.fn();
    const next = vi.fn();
    fixture.componentRef.setInput('label', 'Ciclo atual');
    fixture.componentRef.setInput('startDate', '2026-09-28');
    fixture.componentRef.setInput('endDate', '2026-10-27');
    fixture.componentRef.setInput('previousEnabled', true);
    fixture.componentRef.setInput('nextEnabled', false);
    fixture.componentRef.instance.previous.subscribe(previous);
    fixture.componentRef.instance.next.subscribe(next);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('button');
    buttons[0]?.click();
    buttons[1]?.click();

    expect(previous).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
    expect(buttons[1]?.disabled).toBe(true);
  });
});
