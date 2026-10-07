import { TestBed } from '@angular/core/testing';
import { PageStateComponent } from './page-state.component';

describe('PageStateComponent', () => {
  it('announces an error with its recovery guidance', () => {
    const fixture = TestBed.createComponent(PageStateComponent);
    fixture.componentRef.setInput('state', 'error');
    fixture.componentRef.setInput('title', 'Não foi possível carregar');
    fixture.componentRef.setInput('message', 'Verifique sua conexão e tente novamente.');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.textContent).toContain('Não foi possível carregar');
    expect(root.textContent).toContain('Verifique sua conexão e tente novamente.');
  });
});
