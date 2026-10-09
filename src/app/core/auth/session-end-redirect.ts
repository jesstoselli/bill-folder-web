import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Leaves an authenticated session with a full page load. Every feature store
 * is a root singleton holding the previous user's financial data; reloading is
 * the one reset that cannot miss a store added later.
 */
@Injectable({ providedIn: 'root' })
export class SessionEndRedirect {
  private readonly document = inject(DOCUMENT);

  toLogin(returnUrl?: string | null): void {
    const query =
      returnUrl && !returnUrl.startsWith('/login')
        ? `?returnUrl=${encodeURIComponent(returnUrl)}`
        : '';
    this.document.defaultView?.location.assign(`/login${query}`);
  }
}
