import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SessionEndRedirect } from './session-end-redirect';

describe('SessionEndRedirect', () => {
  function setup() {
    const assign = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: { location: { assign } } } }],
    });
    return { redirect: TestBed.inject(SessionEndRedirect), assign };
  }

  it('reloads the login page', () => {
    const { redirect, assign } = setup();

    redirect.toLogin();

    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('keeps an internal return url', () => {
    const { redirect, assign } = setup();

    redirect.toLogin('/despesas?cycleId=c1');

    expect(assign).toHaveBeenCalledWith('/login?returnUrl=%2Fdespesas%3FcycleId%3Dc1');
  });

  it('drops a return url that points back to login', () => {
    const { redirect, assign } = setup();

    redirect.toLogin('/login?returnUrl=%2Fhome');

    expect(assign).toHaveBeenCalledWith('/login');
  });
});
