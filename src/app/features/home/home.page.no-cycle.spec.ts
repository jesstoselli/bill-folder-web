import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { HomePage } from './home.page';
import { HomeStore } from './home.store';

describe('HomePage without a current cycle', () => {
  it('invites a new account to create its first cycle', async () => {
    const { fixture } = await setup({ noCycle: true, cycles: [] });

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Você ainda não tem um ciclo aberto');
    expect(findButton(fixture.nativeElement, 'Criar primeiro ciclo')).toBeTruthy();
    expect(text).not.toContain('Tentar novamente');
  });

  it('offers to create the current period when only other cycles exist', async () => {
    const { fixture } = await setup({ noCycle: true, cycles: [pastCycle] });

    expect(fixture.nativeElement.textContent).toContain('Nenhum ciclo cobre a data de hoje');
    expect(findButton(fixture.nativeElement, 'Criar ciclo')).toBeTruthy();
  });

  it('keeps the retry for any other failure', async () => {
    const { fixture } = await setup({ noCycle: false, cycles: [] });

    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar a Home');
    expect(findButton(fixture.nativeElement, 'Tentar novamente')).toBeTruthy();
  });

  it('opens the cycle form and loads Home for the cycle it created', async () => {
    const { fixture, dialog, home, closed } = await setup({ noCycle: true, cycles: [] });

    findButton(fixture.nativeElement, 'Criar primeiro ciclo')!.click();
    await vi.waitFor(() => expect(dialog.open).toHaveBeenCalled());
    const [, config] = dialog.open.mock.calls[0] as unknown as [unknown, { data: unknown }];
    expect(config.data).toEqual({ mode: 'create' });

    closed.next({ ...pastCycle, id: 'created' });
    closed.complete();

    expect(home.load).toHaveBeenCalledWith('created');
  });
});

async function setup(options: { noCycle: boolean; cycles: CycleResponse[] }) {
  const closed = new Subject<CycleResponse | undefined>();
  const dialog = { open: vi.fn(() => ({ afterClosed: () => closed.asObservable() })) };
  const home = {
    state: signal({ kind: 'error' as const, message: 'Falhou.' }).asReadonly(),
    noCycle: signal(options.noCycle).asReadonly(),
    recentDailyExpenses: signal([]).asReadonly(),
    recentState: signal({ kind: 'loading' as const }).asReadonly(),
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    refreshRecent: vi.fn(() => Promise.resolve()),
    selectCycle: vi.fn(() => true),
  };
  await TestBed.configureTestingModule({
    imports: [HomePage],
    providers: [
      provideRouter([]),
      { provide: HomeStore, useValue: home },
      { provide: MatDialog, useValue: dialog },
      {
        provide: CycleStore,
        useValue: {
          state: signal({
            kind: 'content' as const,
            data: options.cycles,
            refreshing: false,
          }).asReadonly(),
          cycles: signal(options.cycles).asReadonly(),
          current: signal(null).asReadonly(),
          previous: signal(null).asReadonly(),
          next: signal(null).asReadonly(),
          load: vi.fn(() => Promise.resolve()),
        },
      },
    ],
  });
  TestBed.overrideProvider(MatDialog, { useValue: dialog });
  await TestBed.compileComponents();
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  return { fixture, dialog, home, closed };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes(label),
  );
}

const pastCycle: CycleResponse = {
  id: 'cycle-past',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  label: 'agosto/2026',
  isRecurrenceGenerated: false,
  isCurrent: false,
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-01T10:00:00Z',
};
