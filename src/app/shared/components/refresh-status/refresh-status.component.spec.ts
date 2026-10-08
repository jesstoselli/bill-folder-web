import { TestBed } from '@angular/core/testing';
import { RefreshStatusComponent } from './refresh-status.component';

describe('RefreshStatusComponent', () => {
  it('keeps the refresh failure actionable beside the last-success time', () => {
    const fixture = TestBed.createComponent(RefreshStatusComponent);
    fixture.componentRef.setInput('state', {
      kind: 'content',
      data: [],
      refreshing: false,
      refreshError: 'Não foi possível atualizar.',
      lastSuccessfulAt: new Date('2026-10-08T12:00:00-03:00').getTime(),
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível atualizar.',
    );
    expect(root.textContent).toContain('Última atualização bem-sucedida:');
    expect(root.querySelector('button')?.textContent).toContain('Tentar novamente');
  });
});
