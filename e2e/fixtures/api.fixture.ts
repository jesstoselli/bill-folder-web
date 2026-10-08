import { test as base, type BrowserContext, type Route } from '@playwright/test';

const refreshCookieName = 'bf_refresh';
const refreshCookiePath = '/v1/auth/web';

export interface RequestGate {
  readonly requested: Promise<void>;
  release(): void;
}

export interface ApiWrite {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

export interface BillFolderApiFixture {
  readonly writes: readonly ApiWrite[];
  readonly events: readonly string[];
  startAuthenticated(context: BrowserContext): Promise<void>;
  delayNextRefresh(): RequestGate;
  delayNextLogout(): RequestGate;
  failNextHomeRequestWith401(): void;
}

interface InternalGate extends RequestGate {
  markRequested(): void;
  waitForRelease(): Promise<void>;
}

interface ExpenseFixture {
  id: string;
  dueDate: string;
  label: string;
  expectedAmount: number;
  actualAmount: number | null;
  status: string;
  paidDate: string | null;
  paidFromAccountId: string | null;
  paidFromAccountName: string | null;
  categoryId: string;
  categoryName: string;
  linkedCardStatementId: string | null;
  templateId: string | null;
  notes: string | null;
  occurrenceAmount: number | null;
  occurrencesTotal: number | null;
  occurrencesPaid: number;
  paidToDate: number;
  createdAt: string;
  updatedAt: string;
}

interface StatementFixture {
  id: string;
  cardId: string;
  cardName: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: 'closed' | 'paid';
  paidDate: string | null;
  actualAmount: number | null;
  paidFromAccountId: string | null;
  paidFromAccountName: string | null;
  totalAmount: number;
  installmentsCount: number;
  linkedExpenseId: string | null;
  createdAt: string;
  updatedAt: string;
}

const cycle = {
  id: 'cycle-oct-2026',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'Outubro 2026',
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const category = {
  id: 'category-home',
  key: 'home',
  namePt: 'Casa',
  isSystem: true,
  displayOrder: 1,
};

const checkingAccount = {
  id: 'checking-primary',
  bankName: 'Conta E2E',
  branch: '0001',
  accountNumber: '000001',
  initialBalance: 2_000,
  isPrimary: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const creditCard = {
  id: 'card-e2e',
  name: 'Cartão E2E',
  issuerBank: 'Banco Local',
  brand: 'Teste',
  closingDay: 1,
  dueDay: 10,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const weeklyExpense: ExpenseFixture = {
  id: 'expense-weekly',
  dueDate: '2026-10-30',
  label: 'Terapia semanal',
  expectedAmount: 600,
  actualAmount: 150,
  status: 'pending',
  paidDate: null,
  paidFromAccountId: null,
  paidFromAccountName: null,
  categoryId: category.id,
  categoryName: category.namePt,
  linkedCardStatementId: null,
  templateId: 'weekly-template',
  notes: null,
  occurrenceAmount: 150,
  occurrencesTotal: 4,
  occurrencesPaid: 1,
  paidToDate: 150,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const statementBase: StatementFixture = {
  id: 'statement-closed',
  cardId: creditCard.id,
  cardName: creditCard.name,
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  dueDate: '2026-10-10',
  status: 'closed',
  paidDate: null,
  actualAmount: null,
  paidFromAccountId: null,
  paidFromAccountName: null,
  totalAmount: 420.5,
  installmentsCount: 0,
  linkedExpenseId: 'linked-card-expense',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

class DeterministicApiBoundary implements BillFolderApiFixture {
  private readonly accessToken = crypto.randomUUID();
  private readonly recordedWrites: ApiWrite[] = [];
  private readonly recordedEvents: string[] = [];
  private readonly expenses: ExpenseFixture[] = [{ ...weeklyExpense }];
  private statement: StatementFixture = { ...statementBase };
  private refreshGate: InternalGate | null = null;
  private logoutGate: InternalGate | null = null;
  private rejectNextHome = false;
  private homeRemaining = 1_500;
  private waitingForHomeAfterWrite = false;

  get writes(): readonly ApiWrite[] {
    return this.recordedWrites;
  }

  get events(): readonly string[] {
    return this.recordedEvents;
  }

  async startAuthenticated(context: BrowserContext): Promise<void> {
    await context.addCookies([
      {
        name: refreshCookieName,
        value: crypto.randomUUID(),
        domain: '127.0.0.1',
        path: refreshCookiePath,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }

  delayNextRefresh(): RequestGate {
    this.refreshGate = createGate();
    return this.refreshGate;
  }

  delayNextLogout(): RequestGate {
    this.logoutGate = createGate();
    return this.logoutGate;
  }

  failNextHomeRequestWith401(): void {
    this.rejectNextHome = true;
  }

  async handle(route: Route): Promise<void> {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (method === 'POST' && path === '/v1/auth/web/login') {
      await this.json(route, this.authResponse(), 200, this.activeCookie(crypto.randomUUID()));
      return;
    }
    if (method === 'POST' && path === '/v1/auth/web/refresh') {
      await this.refresh(route);
      return;
    }
    if (method === 'POST' && path === '/v1/auth/web/logout') {
      await this.logout(route);
      return;
    }

    if (request.headers()['authorization'] !== `Bearer ${this.accessToken}`) {
      await this.json(route, { error: 'unauthorized' }, 401);
      return;
    }

    if (method === 'GET' && path === '/v1/cycles') {
      await this.json(route, [cycle]);
      return;
    }
    if (method === 'GET' && path === '/v1/cycles/current') {
      await this.json(route, cycle);
      return;
    }
    if (method === 'GET' && path === '/v1/home/') {
      if (this.rejectNextHome) {
        this.rejectNextHome = false;
        this.recordedEvents.push('home:unauthorized');
        await this.json(route, { error: 'expired_access_token' }, 401);
        return;
      }
      if (this.waitingForHomeAfterWrite) {
        this.waitingForHomeAfterWrite = false;
        this.recordedEvents.push('home:refreshed-after-write');
      }
      await this.json(route, this.homeResponse());
      return;
    }
    if (method === 'GET' && path === '/v1/daily-expenses') {
      await this.json(route, []);
      return;
    }
    if (method === 'GET' && path === '/v1/categories') {
      await this.json(route, [category]);
      return;
    }
    if (method === 'GET' && path === '/v1/checking-accounts') {
      await this.json(route, [checkingAccount]);
      return;
    }
    if (path === '/v1/expenses/' && method === 'GET') {
      await this.json(route, this.expenses);
      return;
    }
    if (path === '/v1/expenses/' && method === 'POST') {
      const body = request.postDataJSON() as {
        dueDate: string;
        label: string;
        expectedAmount: number;
        categoryId: string;
        notes: string | null;
      };
      const created = {
        ...weeklyExpense,
        ...body,
        id: 'expense-created',
        actualAmount: null,
        status: 'pending',
        categoryName: category.namePt,
        templateId: null,
        occurrenceAmount: null,
        occurrencesTotal: null,
        occurrencesPaid: 0,
        paidToDate: 0,
      };
      this.recordWrite(method, path, body);
      const existingIndex = this.expenses.findIndex((expense) => expense.id === created.id);
      if (existingIndex >= 0) {
        this.expenses.splice(existingIndex, 1, created);
      } else {
        this.expenses.push(created);
      }
      this.homeRemaining -= body.expectedAmount;
      this.waitingForHomeAfterWrite = true;
      await this.json(route, created, 201);
      return;
    }
    if (path === '/v1/expenses/expense-weekly/pay-occurrence' && method === 'POST') {
      const body = request.postDataJSON();
      this.recordWrite(method, path, body);
      this.expenses[0] = {
        ...this.expenses[0],
        actualAmount: 300,
        occurrencesPaid: 2,
        paidToDate: 300,
        paidDate: '2026-10-08',
        updatedAt: '2026-10-08T12:00:00Z',
      };
      await this.json(route, this.expenses[0]);
      return;
    }
    if (method === 'GET' && path === '/v1/credit-card-accounts/') {
      await this.json(route, [creditCard]);
      return;
    }
    if (method === 'GET' && path === '/v1/card-entries/') {
      await this.json(route, []);
      return;
    }
    if (method === 'GET' && path === '/v1/card-statements/') {
      await this.json(route, [{ ...this.statement, installmentsCount: 0 }]);
      return;
    }
    if (method === 'GET' && path === '/v1/card-statements/statement-closed') {
      await this.json(route, { ...this.statement, installments: [] });
      return;
    }
    if (method === 'POST' && path === '/v1/card-statements/statement-closed/pay') {
      const body = request.postDataJSON() as {
        actualAmount: number;
        paidDate: string;
        paidFromAccountId: string | null;
      };
      this.recordWrite(method, path, body);
      this.statement = {
        ...this.statement,
        status: 'paid',
        actualAmount: body.actualAmount,
        paidDate: body.paidDate,
        paidFromAccountId: body.paidFromAccountId,
        paidFromAccountName: null,
        updatedAt: '2026-10-08T12:00:00Z',
      };
      await this.json(route, { ...this.statement, installmentsCount: 0 });
      return;
    }

    await this.json(route, { error: 'unexpected_e2e_request', method, path }, 501);
  }

  private async refresh(route: Route): Promise<void> {
    const cookieHeader = route.request().headers()['cookie'] ?? '';
    if (!cookieHeader.includes(`${refreshCookieName}=`)) {
      this.recordedEvents.push('refresh:rejected');
      await this.json(route, { error: 'logged_out' }, 401);
      return;
    }

    const gate = this.refreshGate;
    if (gate) {
      this.refreshGate = null;
      this.recordedEvents.push('refresh:requested');
      gate.markRequested();
      await gate.waitForRelease();
    }

    this.recordedEvents.push('refresh:accepted');
    await this.json(route, this.authResponse(), 200, this.activeCookie(crypto.randomUUID()));
  }

  private async logout(route: Route): Promise<void> {
    this.recordedEvents.push('logout:requested');
    const gate = this.logoutGate;
    if (gate) {
      this.logoutGate = null;
      gate.markRequested();
      await gate.waitForRelease();
    }
    this.recordedEvents.push('logout:accepted');
    await route.fulfill({
      status: 204,
      headers: { 'set-cookie': this.expiredCookie() },
    });
  }

  private authResponse() {
    return {
      accessToken: this.accessToken,
      accessTokenExpiresAt: '2026-10-08T18:00:00Z',
      user: {
        id: 'user-e2e',
        email: 'browser-user@example.test',
        displayName: 'Browser User',
      },
    };
  }

  private homeResponse() {
    return {
      cycle,
      balance: {
        checkingAccountsTotal: 2_000,
        expectedIncome: 3_000,
        receivedIncome: 3_000,
        expectedExpenses: 600,
        paidExpenses: 150,
        expectedCardStatements: 420.5,
        dailyExpensesSpent: 0,
        remaining: this.homeRemaining,
        paidCardStatements: this.statement.status === 'paid' ? 420.5 : 0,
      },
      incomeBreakdown: { expected: 3_000, received: 3_000, late: 0, notOccurred: 0 },
      expenseBreakdown: { pending: 450, overdue: 0, paid: 150 },
      upcomingExpenses: [],
      cardStatementsInCycle: [],
      categoryBreakdown: [
        {
          categoryId: category.id,
          categoryKey: category.key,
          categoryName: category.namePt,
          amount: 600,
        },
      ],
    };
  }

  private recordWrite(method: string, path: string, body: unknown): void {
    this.recordedWrites.push({ method, path, body });
  }

  private activeCookie(value: string): string {
    return `${refreshCookieName}=${value}; Path=${refreshCookiePath}; HttpOnly; SameSite=Lax`;
  }

  private expiredCookie(): string {
    return `${refreshCookieName}=; Path=${refreshCookiePath}; HttpOnly; SameSite=Lax; Max-Age=0`;
  }

  private async json(route: Route, body: unknown, status = 200, setCookie?: string): Promise<void> {
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: setCookie ? { 'set-cookie': setCookie } : undefined,
      body: JSON.stringify(body),
    });
  }
}

function createGate(): InternalGate {
  let requestedResolve!: () => void;
  let releaseResolve!: () => void;
  let requested = false;
  let released = false;
  const requestedPromise = new Promise<void>((resolve) => {
    requestedResolve = resolve;
  });
  const releasePromise = new Promise<void>((resolve) => {
    releaseResolve = resolve;
  });

  return {
    requested: requestedPromise,
    markRequested() {
      if (!requested) {
        requested = true;
        requestedResolve();
      }
    },
    release() {
      if (!released) {
        released = true;
        releaseResolve();
      }
    },
    waitForRelease() {
      return releasePromise;
    },
  };
}

export const test = base.extend<{ api: BillFolderApiFixture }>({
  api: async ({ context }, use) => {
    const api = new DeterministicApiBoundary();
    await context.route('**/v1/**', (route) => api.handle(route));
    await use(api);
  },
});

export { expect } from '@playwright/test';
