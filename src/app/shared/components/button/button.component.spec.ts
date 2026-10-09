import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

@Component({
  imports: [ButtonComponent],
  template: `
    <button type="button" appButton>Atualizar</button>
    <button type="submit" appButton variant="primary" disabled>Salvar</button>
    <button type="button" appButton variant="text" size="sm" tone="danger">Excluir</button>
  `,
})
class HostComponent {}

describe('ButtonComponent', () => {
  function buttons(): HTMLButtonElement[] {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  }

  it('defaults to the secondary medium variant on the native button', () => {
    const [refresh] = buttons();

    expect(refresh.classList).toContain('bf-button');
    expect(refresh.classList).toContain('bf-button--secondary');
    expect(refresh.classList).not.toContain('bf-button--sm');
    expect(refresh.textContent?.trim()).toBe('Atualizar');
  });

  it('keeps native type and disabled semantics', () => {
    const [, submit] = buttons();

    expect(submit.classList).toContain('bf-button--primary');
    expect(submit.type).toBe('submit');
    expect(submit.disabled).toBe(true);
  });

  it('applies size and tone modifiers', () => {
    const [, , remove] = buttons();

    expect(remove.classList).toContain('bf-button--text');
    expect(remove.classList).toContain('bf-button--sm');
    expect(remove.classList).toContain('bf-button--danger');
  });
});
