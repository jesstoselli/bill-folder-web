import { TestBed } from '@angular/core/testing';
import { BILL_FOLDER_ICON_PATHS, IconComponent } from './icon.component';
import type { BillFolderIconName } from './icon.component';

describe('IconComponent', () => {
  it('provides the local Material Filled vectors for admin navigation', () => {
    const iconNames = Object.keys(BILL_FOLDER_ICON_PATHS);

    expect(iconNames).toContain('calendarMonth');
    expect(iconNames).toContain('accountBalance');
  });

  it.each(Object.keys(BILL_FOLDER_ICON_PATHS) as BillFolderIconName[])(
    'renders the local %s vector as a decorative icon',
    (name) => {
      const fixture = TestBed.createComponent(IconComponent);
      fixture.componentRef.setInput('name', name);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const paths = Array.from(root.querySelectorAll<SVGPathElement>('path'));

      expect(root.getAttribute('aria-hidden')).toBe('true');
      expect(root.getAttribute('data-icon')).toBe(name);
      expect(paths.map((path) => path.getAttribute('d'))).toEqual([
        ...BILL_FOLDER_ICON_PATHS[name],
      ]);
    },
  );
});
