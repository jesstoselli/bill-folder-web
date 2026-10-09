import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MAX_DIGITS = 11; // 999.999.999,99
const amountFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Currency mask for amount fields, bank-app style: typed digits fill from the
 * cents (1, 2, 3, 4 -> 12,34), so phones only need the numeric keypad. A
 * paste or programmatic fill ("1.234,56", "45,9", "R$ 120", "275.40") is
 * read as a literal amount instead. The form control holds a number (or null
 * when empty), so validators and API payloads are unchanged.
 */
@Directive({
  selector: 'input[appMoneyInput]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MoneyInputDirective),
      multi: true,
    },
  ],
  host: {
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'handleInput($event)',
    '(blur)': 'onTouched()',
  },
})
export class MoneyInputDirective implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private onChange: (value: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: number | null | undefined): void {
    this.input.value = value === null || value === undefined ? '' : formatAmount(value);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.input.disabled = disabled;
  }

  protected handleInput(event: Event): void {
    const { inputType, data } = event as InputEvent;
    const wholeValue =
      inputType === 'insertFromPaste' || inputType === 'insertFromDrop' || (data?.length ?? 0) > 1;
    const value = wholeValue
      ? parseAmountText(this.input.value)
      : centsFromDigits(this.input.value);
    this.input.value = value === null ? '' : formatAmount(value);
    this.onChange(value);
  }
}

export function formatAmount(value: number): string {
  return amountFormatter.format(value);
}

/** All digits are kept and the last two become cents: "12,34" + "5" -> 123,45. */
export function centsFromDigits(text: string): number | null {
  // Leading zeros carry no value; dropping them lets backspace empty the field.
  const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);
  return digits ? Number(digits) / 100 : null;
}

/**
 * Reads a pasted amount as people write it: comma decimals with dot
 * thousands ("1.234,56"), or a dot decimal with at most two places
 * ("275.40"). Returns null when there are no digits.
 */
export function parseAmountText(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(cleaned)) return null;

  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned
      .replace(/\./g, '')
      .replace(/,(?=[^,]*$)/, '.')
      .replace(/,/g, '');
  } else {
    const lastDot = cleaned.lastIndexOf('.');
    const decimals = lastDot >= 0 ? cleaned.length - lastDot - 1 : 0;
    normalized =
      lastDot >= 0 && decimals > 0 && decimals <= 2
        ? cleaned.slice(0, lastDot).replace(/\./g, '') + '.' + cleaned.slice(lastDot + 1)
        : cleaned.replace(/\./g, '');
  }

  const value = Math.round(Number(normalized) * 100) / 100;
  return Number.isFinite(value) && value < 10 ** (MAX_DIGITS - 2) ? value : null;
}
