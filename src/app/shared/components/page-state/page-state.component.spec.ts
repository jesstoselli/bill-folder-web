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

  it('renders the recovery action inside the card and emits on click', () => {
    const fixture = TestBed.createComponent(PageStateComponent);
    fixture.componentRef.setInput('state', 'error');
    fixture.componentRef.setInput('title', 'Não foi possível carregar');
    fixture.componentRef.setInput('actionLabel', 'Tentar novamente');
    let emitted = 0;
    fixture.componentInstance.action.subscribe(() => emitted++);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[role="alert"] button',
    );

    expect(button?.textContent?.trim()).toBe('Tentar novamente');
    button?.click();
    expect(emitted).toBe(1);
  });

  it('renders no action without a label', () => {
    const fixture = TestBed.createComponent(PageStateComponent);
    fixture.componentRef.setInput('state', 'empty');
    fixture.componentRef.setInput('title', 'Nada por aqui');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
