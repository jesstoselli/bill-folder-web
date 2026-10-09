import { TestBed } from '@angular/core/testing';
import { CycleBarComponent } from './cycle-bar.component';

describe('CycleBarComponent', () => {
  function create(busy: boolean) {
    const fixture = TestBed.createComponent(CycleBarComponent);
    fixture.componentRef.setInput('cycle', {
      label: 'Outubro 2026',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.componentRef.setInput('busy', busy);
    fixture.componentRef.setInput('busyLabel', 'Atualizando despesas…');
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('navigates when idle and shows no status', () => {
    const { fixture, root } = create(false);
    let previous = 0;
    fixture.componentInstance.previous.subscribe(() => previous++);

    root.querySelector<HTMLButtonElement>('button[aria-label="Ciclo anterior"]')?.click();

    expect(previous).toBe(1);
    expect(root.querySelector('[role="status"]')).toBeNull();
  });

  it('locks the arrows and announces the refresh while busy', () => {
    const { root } = create(true);

    expect(
      root.querySelector<HTMLButtonElement>('button[aria-label="Ciclo anterior"]')?.disabled,
    ).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>('button[aria-label="Próximo ciclo"]')?.disabled,
    ).toBe(true);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Atualizando despesas…');
  });
});
