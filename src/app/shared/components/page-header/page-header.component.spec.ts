import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

@Component({
  imports: [PageHeaderComponent],
  template: `
    <app-page-header heading="Despesas do ciclo" subtitle="Contas por vencimento.">
      <button type="button">Atualizar</button>
    </app-page-header>
  `,
})
class HostComponent {}

describe('PageHeaderComponent', () => {
  it('renders the page heading, subtitle and projected actions', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Despesas do ciclo');
    expect(root.querySelector('header p')?.textContent).toContain('Contas por vencimento.');
    expect(root.querySelector('.page-header__actions button')?.textContent).toContain('Atualizar');
  });
});
