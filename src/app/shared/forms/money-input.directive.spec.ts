import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MoneyInputDirective, parseAmountText } from './money-input.directive';

@Component({
  imports: [ReactiveFormsModule, MoneyInputDirective],
  template: `<input appMoneyInput [formControl]="amount" />`,
})
class HostComponent {
  readonly amount = new FormControl<number | null>(null);
}

describe('MoneyInputDirective', () => {
  function setup(initial: number | null = null) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.amount.setValue(initial);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    const control = fixture.componentInstance.amount;

    const typeKey = (key: string) => {
      input.value += key;
      input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: key }));
    };
    const backspace = () => {
      input.value = input.value.slice(0, -1);
      input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward' }));
    };
    const paste = (text: string) => {
      input.value = text;
      input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste' }));
    };
    const fill = (text: string) => {
      input.value = text;
      input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text }));
    };
    return { input, control, typeKey, backspace, paste, fill };
  }

  it('fills typed digits from the cents and keeps a number in the control', () => {
    const { input, control, typeKey } = setup();

    for (const key of '123456') typeKey(key);

    expect(input.value).toBe('1.234,56');
    expect(control.value).toBe(1234.56);
  });

  it('ignores non-digits and drops the last digit on backspace', () => {
    const { input, control, typeKey, backspace } = setup();

    for (const key of '12a,3') typeKey(key);
    backspace();

    expect(input.value).toBe('0,12');
    expect(control.value).toBe(0.12);
  });

  it('becomes empty (null) when every digit is removed', () => {
    const { input, control, typeKey, backspace } = setup();

    typeKey('5');
    backspace();
    backspace();
    backspace();
    backspace();

    expect(input.value).toBe('');
    expect(control.value).toBeNull();
  });

  it('reads a paste as a literal amount', () => {
    const { input, control, paste } = setup();

    paste('R$ 1.234,56');

    expect(input.value).toBe('1.234,56');
    expect(control.value).toBe(1234.56);
  });

  it('reads a multi-character fill as a literal amount', () => {
    const { control, fill } = setup();

    fill('150');
    expect(control.value).toBe(150);

    fill('275.40');
    expect(control.value).toBe(275.4);
  });

  it('formats the value written by the form', () => {
    const { input } = setup(420.5);

    expect(input.value).toBe('420,50');
  });

  it('asks phones for the numeric keypad', () => {
    const { input } = setup();

    expect(input.getAttribute('inputmode')).toBe('numeric');
  });
});

describe('parseAmountText', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['45,9', 45.9],
    ['R$ 120', 120],
    ['275.40', 275.4],
    ['1.234', 1234],
    ['  ', null],
  ])('parses %s', (text, expected) => {
    expect(parseAmountText(text)).toBe(expected);
  });
});
