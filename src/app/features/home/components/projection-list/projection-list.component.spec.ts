import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { dailyExpense, expense } from '../../home.fixtures';
import { projectRecent, projectStatement, projectUpcoming } from '../../home-projections';
import { statement } from '../../home.fixtures';
import { ProjectionListComponent } from './projection-list.component';

describe('ProjectionListComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

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

  it('renders exact keyboard-accessible deep links for every actionable obligation', () => {
    const fixture = TestBed.createComponent(ProjectionListComponent);
    fixture.componentRef.setInput('cycleId', 'cycle-1');
    fixture.componentRef.setInput('rows', [
      projectUpcoming(expense({ id: 'ordinary', label: 'Internet' })),
      projectUpcoming(
        expense({
          id: 'provisioned',
          label: 'Terapia',
          occurrencesTotal: 4,
          occurrencesPaid: 1,
          paidToDate: 200,
        }),
      ),
      projectStatement(statement({ id: 'statement-1', cardId: 'card-1', status: 'closed' })),
      projectStatement(statement({ id: 'open', status: 'open' })),
    ]);
    fixture.componentRef.setInput('emptyMessage', 'Sem itens.');
    fixture.detectChanges();
    const links = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        '.projection-list__action',
      ),
    ];

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Pagar Internet',
      'Pagar ocorrência de Terapia',
      'Pagar fatura Cartão principal',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/despesas?cycleId=cycle-1&expenseId=ordinary&action=pay',
      '/despesas?cycleId=cycle-1&expenseId=provisioned&action=pay-occurrence',
      '/cartoes?cardId=card-1&statementId=statement-1&action=pay-statement',
    ]);
  });
});
