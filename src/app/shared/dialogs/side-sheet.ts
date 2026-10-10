import { MatDialogConfig } from '@angular/material/dialog';

/**
 * Dialog config for an edit form that slides in from the right edge, full
 * height. `bf-side-sheet` (styles.scss) stretches the form so its actions sit
 * at the bottom edge.
 */
export function sideSheetConfig<D>(
  config: Omit<MatDialogConfig<D>, 'width'> & { readonly width?: string },
): MatDialogConfig<D> {
  const { width = '30rem', ...rest } = config;
  return {
    position: { right: '0' },
    width: `min(${width}, 100vw)`,
    maxWidth: '100vw',
    height: '100dvh',
    maxHeight: '100dvh',
    autoFocus: 'first-tabbable',
    restoreFocus: false,
    panelClass: 'bf-side-sheet',
    ...rest,
  };
}
