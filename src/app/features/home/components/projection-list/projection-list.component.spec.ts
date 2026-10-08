import { TestBed } from '@angular/core/testing';
import { dailyExpense, expense } from '../../home.fixtures';
import { projectRecent, projectUpcoming } from '../../home-projections';
import { ProjectionListComponent } from './projection-list.component';

describe('ProjectionListComponent', () => {
  it('renders financial context, civil due date and a textual status', () => {
    const fixture = TestBed.createComponent(ProjectionListComponent);
    fixture.componentRef.setInput('rows', [
      projectUpcoming(
        expense({
          label: 'Terapia',
          dueDate: '2026-10-16',
          expectedAmount: 800,
          occurrencesTotal: 4,
          occurrencesPaid: 2,
          paidToDate: 400,
        }),
      ),
    ]);
    fixture.componentRef.setInput('emptyMessage', 'Nenhuma conta a vencer neste ciclo.');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Terapia');
    expect(root.querySelector('.projection-list__value data')?.getAttribute('value')).toBe('400');
    expect(root.textContent).toContain('R$ 800,00 no mês');
    expect(root.querySelector('time')?.textContent?.trim()).toBe('16/10/2026');
    expect(root.querySelector('.projection-list__status')?.textContent?.trim()).toBe('Pendente');
  });

  it('labels a recent daily expense with its date instead of a due date', () => {
    const fixture = TestBed.createComponent(ProjectionListComponent);
    fixture.componentRef.setInput('rows', projectRecent([dailyExpense({ date: '2026-10-20' })]));
    fixture.componentRef.setInput('emptyMessage', 'Nenhum gasto diário neste ciclo.');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.projection-list__date span')?.textContent?.trim()).toBe('Data');
    expect(root.querySelector('.projection-list__date time')?.getAttribute('datetime')).toBe(
      '2026-10-20',
    );
  });
});
