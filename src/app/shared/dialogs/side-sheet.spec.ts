import { describe, expect, it } from 'vitest';
import { sideSheetConfig } from './side-sheet';

describe('sideSheetConfig', () => {
  it('docks a full-height sheet to the right with the shared panel class', () => {
    const config = sideSheetConfig({ data: { id: 1 }, ariaLabelledBy: 'title' });

    expect(config).toMatchObject({
      data: { id: 1 },
      ariaLabelledBy: 'title',
      position: { right: '0' },
      width: 'min(30rem, 100vw)',
      height: '100dvh',
      panelClass: 'bf-side-sheet',
      restoreFocus: false,
    });
  });

  it('takes a custom width and overrides', () => {
    const config = sideSheetConfig({ width: '32rem', restoreFocus: true });

    expect(config.width).toBe('min(32rem, 100vw)');
    expect(config.restoreFocus).toBe(true);
  });
});
