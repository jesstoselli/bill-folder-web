import { TestBed } from '@angular/core/testing';
import { CardStatementDetailResponse } from '../../cards.models';
import { StatementSummaryComponent } from './statement-summary.component';

function statement(overrides: Partial<CardStatementDetailResponse>): CardStatementDetailResponse {
  return {
    id: 'statement-1',
    cardId: 'card-1',
    cardName: 'Nubank',
    periodStart: '2026-09-11',
    periodEnd: '2026-10-10',
    dueDate: '2026-10-17',
    status: 'closed',
    paidDate: null,
    actualAmount: null,
    paidFromAccountId: null,
    paidFromAccountName: null,
    totalAmount: 300,
    linkedExpenseId: null,
    createdAt: '2026-09-11T00:00:00Z',
    updatedAt: '2026-09-11T00:00:00Z',
    installments: [],
    ...overrides,
  };
}

function render(value: CardStatementDetailResponse) {
  const fixture = TestBed.createComponent(StatementSummaryComponent);
  fixture.componentRef.setInput('statement', value);
  fixture.detectChanges();
  const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  return { fixture, labels: buttons.map((button) => button.textContent?.trim()), buttons };
}

describe('StatementSummaryComponent', () => {
  it('offers undoing the payment of a paid statement', () => {
    const { fixture, labels, buttons } = render(
      statement({ status: 'paid', paidDate: '2026-10-17', actualAmount: 300 }),
    );
    const undo = vi.fn();
    fixture.componentInstance.undoPayment.subscribe(undo);

    expect(labels).toEqual(['Desfazer pagamento']);
    buttons[0].click();
    expect(undo).toHaveBeenCalledOnce();
  });

  it('offers paying, not undoing, a closed statement', () => {
    expect(render(statement({})).labels).toEqual(['Pagar fatura']);
  });

  it('shows the credit of a statement covered by refunds, with nothing to pay', () => {
    const { fixture, labels } = render(statement({ totalAmount: -50 }));

    expect(fixture.nativeElement.textContent).toContain('Crédito na fatura');
    expect(labels).toEqual([]);
  });
});
