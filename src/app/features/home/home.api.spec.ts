import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { dailyExpense, homeFixture } from './home.fixtures';
import { HomeApi } from './home.api';

describe('HomeApi', () => {
  let api: HomeApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1/', production: false } },
      ],
    });
    api = TestBed.inject(HomeApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('loads the selected cycle from the trailing-slash Home endpoint', async () => {
    const result = firstValueFrom(api.get('cycle-1'));
    const request = backend.expectOne('/v1/home/?cycleId=cycle-1');

    expect(request.request.method).toBe('GET');
    request.flush(homeFixture);

    await expect(result).resolves.toEqual(homeFixture);
  });

  it('loads daily expenses inside the selected civil-date interval', async () => {
    const response = [dailyExpense()];
    const result = firstValueFrom(api.listDailyExpenses('2026-10-01', '2026-10-31'));
    const request = backend.expectOne('/v1/daily-expenses?from=2026-10-01&to=2026-10-31');

    expect(request.request.method).toBe('GET');
    request.flush(response);

    await expect(result).resolves.toEqual(response);
  });
});
