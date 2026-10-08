import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { test as base, type BrowserContext } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:4301';
const appOrigin = 'http://127.0.0.1:4200';
const refreshCookieName = 'bf_refresh';
const refreshCookiePath = '/v1/auth/web';
const expectedLogin = {
  email: 'browser-user@example.test',
  password: 'local-only-password',
};

export interface RequestGate {
  readonly requested: Promise<void>;
  release(): void;
}

export interface ApiWrite {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

export interface ApiRead {
  readonly path: string;
  readonly query: string;
}

export interface AuthRequestEvidence {
  readonly operation: 'login' | 'refresh' | 'logout';
  readonly originAccepted: boolean;
  readonly bodyValidated: boolean;
  readonly cookiePresent: boolean;
  readonly cookieMatchedCurrent: boolean;
}

export interface CorsPreflightEvidence {
  readonly path: string;
  readonly requestedMethod: string;
  readonly requestedHeaders: readonly string[];
}

export interface BillFolderApiFixture {
  readonly writes: readonly ApiWrite[];
  readonly reads: readonly ApiRead[];
  readonly authRequests: readonly AuthRequestEvidence[];
  readonly preflights: readonly CorsPreflightEvidence[];
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
  private readonly recordedWrites: ApiWrite[] = [];
  private readonly recordedReads: ApiRead[] = [];
  private readonly recordedAuthRequests: AuthRequestEvidence[] = [];
  private readonly recordedPreflights: CorsPreflightEvidence[] = [];
  private readonly recordedEvents: string[] = [];
  private readonly expenses: ExpenseFixture[] = [{ ...weeklyExpense }];
  private statement: StatementFixture = { ...statementBase };
  private currentAccessToken: string | null = null;
  private currentRefreshCookie: string | null = null;
  private refreshGate: InternalGate | null = null;
  private logoutGate: InternalGate | null = null;
  private rejectNextHome = false;
  private awaitingHomeRetry = false;
  private homeRemaining = 1_500;
  private waitingForHomeAfterWrite = false;

  get writes(): readonly ApiWrite[] {
    return this.recordedWrites;
  }

  get reads(): readonly ApiRead[] {
    return this.recordedReads;
  }

  get authRequests(): readonly AuthRequestEvidence[] {
    return this.recordedAuthRequests;
  }

  get preflights(): readonly CorsPreflightEvidence[] {
    return this.recordedPreflights;
  }

  get events(): readonly string[] {
    return this.recordedEvents;
  }

  async startAuthenticated(context: BrowserContext): Promise<void> {
    this.currentRefreshCookie = randomUUID();
    await context.addCookies([
      {
        name: refreshCookieName,
        value: this.currentRefreshCookie,
        domain: '127.0.0.1',
        path: refreshCookiePath,
        httpOnly: true,
        secure: false,
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

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? '';
    const url = new URL(request.url ?? '/', apiOrigin);

    if (request.headers.host !== '127.0.0.1:4301') {
      this.json(response, { error: 'unexpected_host' }, 421, false);
      return;
    }
    if (request.headers.origin !== appOrigin) {
      this.json(response, { error: 'unexpected_origin' }, 403, false);
      return;
    }
    if (method === 'OPTIONS') {
      this.preflight(request, response, url);
      return;
    }
    if (!this.isKnownRequest(method, url)) {
      this.json(
        response,
        { error: 'unexpected_e2e_request', method, path: url.pathname, query: url.search },
        501,
      );
      return;
    }

    if (method === 'POST' && url.pathname === '/v1/auth/web/login') {
      await this.login(request, response);
      return;
    }
    if (method === 'POST' && url.pathname === '/v1/auth/web/refresh') {
      await this.refresh(request, response);
      return;
    }
    if (method === 'POST' && url.pathname === '/v1/auth/web/logout') {
      await this.logout(request, response);
      return;
    }

    const authorization = request.headers.authorization;
    if (url.pathname === '/v1/home/' && this.rejectNextHome) {
      this.rejectNextHome = false;
      this.currentAccessToken = randomUUID();
      this.awaitingHomeRetry = true;
    }
    if (!this.currentAccessToken || authorization !== `Bearer ${this.currentAccessToken}`) {
      this.recordedEvents.push(`${url.pathname}:stale-token-rejected`);
      this.json(response, { error: 'expired_access_token' }, 401);
      return;
    }

    if (url.pathname === '/v1/home/' && this.awaitingHomeRetry) {
      this.awaitingHomeRetry = false;
      this.recordedEvents.push('home:retry-used-current-token');
    }
    if (method === 'GET') {
      this.recordedReads.push({ path: url.pathname, query: url.searchParams.toString() });
    }
    await this.protectedRequest(request, response, method, url);
  }

  private preflight(request: IncomingMessage, response: ServerResponse, url: URL): void {
    const requestedMethod = request.headers['access-control-request-method'] ?? '';
    const requestedHeaders = (request.headers['access-control-request-headers'] ?? '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean)
      .sort();
    const headersAllowed = requestedHeaders.every((header) =>
      ['authorization', 'content-type'].includes(header),
    );

    if (!headersAllowed || !this.isKnownRequest(requestedMethod, url)) {
      this.json(response, { error: 'unexpected_preflight' }, 403);
      return;
    }

    this.recordedPreflights.push({ path: url.pathname, requestedMethod, requestedHeaders });
    response.writeHead(204, {
      ...this.corsHeaders(),
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '0',
    });
    response.end();
  }

  private async login(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readJson(request);
    const bodyValidated = deepEqual(body, expectedLogin);
    this.recordedAuthRequests.push({
      operation: 'login',
      originAccepted: true,
      bodyValidated,
      cookiePresent: hasRefreshCookie(request),
      cookieMatchedCurrent: false,
    });
    if (!bodyValidated) {
      this.json(response, { error: 'invalid_login_fixture_body' }, 400);
      return;
    }

    this.rotateAccessToken();
    this.currentRefreshCookie = randomUUID();
    this.recordedEvents.push('login:accepted');
    this.json(response, this.authResponse(), 200, this.activeCookie(this.currentRefreshCookie));
  }

  private async refresh(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readJson(request);
    const receivedCookie = getRefreshCookie(request);
    const cookieMatchedCurrent =
      receivedCookie !== null && receivedCookie === this.currentRefreshCookie;
    this.recordedAuthRequests.push({
      operation: 'refresh',
      originAccepted: true,
      bodyValidated: body === null,
      cookiePresent: receivedCookie !== null,
      cookieMatchedCurrent,
    });
    if (body !== null || !cookieMatchedCurrent) {
      this.recordedEvents.push('refresh:rejected');
      this.json(response, { error: 'logged_out' }, 401);
      return;
    }

    const gate = this.refreshGate;
    if (gate) {
      this.refreshGate = null;
      this.recordedEvents.push('refresh:requested');
      gate.markRequested();
      await gate.waitForRelease();
    }

    this.rotateAccessToken();
    this.currentRefreshCookie = randomUUID();
    this.recordedEvents.push('refresh:accepted');
    this.json(response, this.authResponse(), 200, this.activeCookie(this.currentRefreshCookie));
  }

  private async logout(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readJson(request);
    const receivedCookie = getRefreshCookie(request);
    const cookieMatchedCurrent =
      receivedCookie !== null && receivedCookie === this.currentRefreshCookie;
    this.recordedAuthRequests.push({
      operation: 'logout',
      originAccepted: true,
      bodyValidated: body === null,
      cookiePresent: receivedCookie !== null,
      cookieMatchedCurrent,
    });
    if (body !== null || !cookieMatchedCurrent) {
      this.json(response, { error: 'invalid_logout_fixture_request' }, 400);
      return;
    }

    this.recordedEvents.push('logout:requested');
    const gate = this.logoutGate;
    if (gate) {
      this.logoutGate = null;
      gate.markRequested();
      await gate.waitForRelease();
    }
    this.currentAccessToken = null;
    this.currentRefreshCookie = null;
    this.recordedEvents.push('logout:accepted');
    response.writeHead(204, { ...this.corsHeaders(), 'Set-Cookie': this.expiredCookie() });
    response.end();
  }

  private async protectedRequest(
    request: IncomingMessage,
    response: ServerResponse,
    method: string,
    url: URL,
  ): Promise<void> {
    const path = url.pathname;
    if (method === 'GET' && path === '/v1/cycles') {
      this.json(response, [cycle]);
      return;
    }
    if (method === 'GET' && path === '/v1/cycles/current') {
      this.json(response, cycle);
      return;
    }
    if (method === 'GET' && path === '/v1/home/') {
      if (this.waitingForHomeAfterWrite) {
        this.waitingForHomeAfterWrite = false;
        this.recordedEvents.push('home:refreshed-after-write');
      }
      this.json(response, this.homeResponse());
      return;
    }
    if (method === 'GET' && path === '/v1/daily-expenses') {
      this.json(response, []);
      return;
    }
    if (method === 'GET' && path === '/v1/categories') {
      this.json(response, [category]);
      return;
    }
    if (method === 'GET' && path === '/v1/checking-accounts') {
      this.json(response, [checkingAccount]);
      return;
    }
    if (method === 'GET' && path === '/v1/expenses/') {
      this.json(response, this.expenses);
      return;
    }
    if (method === 'POST' && path === '/v1/expenses/') {
      const body = await readJson(request);
      if (!isCreateExpenseBody(body)) {
        this.json(response, { error: 'invalid_expense_fixture_body' }, 400);
        return;
      }
      const created: ExpenseFixture = {
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
      if (existingIndex >= 0) this.expenses.splice(existingIndex, 1, created);
      else this.expenses.push(created);
      this.homeRemaining -= body.expectedAmount;
      this.waitingForHomeAfterWrite = true;
      this.json(response, created, 201);
      return;
    }
    if (method === 'POST' && path === '/v1/expenses/expense-weekly/pay-occurrence') {
      const body = await readJson(request);
      if (!deepEqual(body, { amount: 150, paidDate: '2026-10-08', paidFromAccountId: null })) {
        this.json(response, { error: 'invalid_occurrence_fixture_body' }, 400);
        return;
      }
      this.recordWrite(method, path, body);
      this.expenses[0] = {
        ...this.expenses[0],
        actualAmount: 300,
        occurrencesPaid: 2,
        paidToDate: 300,
        paidDate: '2026-10-08',
        updatedAt: '2026-10-08T12:00:00Z',
      };
      this.json(response, this.expenses[0]);
      return;
    }
    if (method === 'GET' && path === '/v1/credit-card-accounts/') {
      this.json(response, [creditCard]);
      return;
    }
    if (method === 'GET' && path === '/v1/card-entries/') {
      this.json(response, []);
      return;
    }
    if (method === 'GET' && path === '/v1/card-statements/') {
      this.json(response, [{ ...this.statement, installmentsCount: 0 }]);
      return;
    }
    if (method === 'GET' && path === '/v1/card-statements/statement-closed') {
      this.json(response, { ...this.statement, installments: [] });
      return;
    }
    if (method === 'POST' && path === '/v1/card-statements/statement-closed/pay') {
      const body = await readJson(request);
      const expected = { actualAmount: 420.5, paidDate: '2026-10-08', paidFromAccountId: null };
      if (!deepEqual(body, expected)) {
        this.json(response, { error: 'invalid_statement_fixture_body' }, 400);
        return;
      }
      this.recordWrite(method, path, body);
      this.statement = {
        ...this.statement,
        status: 'paid',
        actualAmount: expected.actualAmount,
        paidDate: expected.paidDate,
        paidFromAccountId: expected.paidFromAccountId,
        paidFromAccountName: null,
        updatedAt: '2026-10-08T12:00:00Z',
      };
      this.json(response, { ...this.statement, installmentsCount: 0 });
    }
  }

  private isKnownRequest(method: string, url: URL): boolean {
    const path = url.pathname;
    const query = url.searchParams.toString();
    if (
      method === 'POST' &&
      ['/v1/auth/web/login', '/v1/auth/web/refresh', '/v1/auth/web/logout'].includes(path)
    ) {
      return query === '';
    }
    if (method === 'GET' && ['/v1/cycles', '/v1/cycles/current'].includes(path)) {
      return query === '';
    }
    if (method === 'GET' && path === '/v1/home/') {
      return query === 'cycleId=cycle-oct-2026';
    }
    if (method === 'GET' && path === '/v1/daily-expenses') {
      return query === 'from=2026-10-01&to=2026-10-31';
    }
    if (
      method === 'GET' &&
      ['/v1/categories', '/v1/checking-accounts', '/v1/credit-card-accounts/'].includes(path)
    ) {
      return query === '';
    }
    if (method === 'GET' && path === '/v1/expenses/') {
      return query === 'from=2026-10-01&to=2026-10-31';
    }
    if (method === 'POST' && path === '/v1/expenses/') return query === '';
    if (method === 'POST' && path === '/v1/expenses/expense-weekly/pay-occurrence') {
      return query === '';
    }
    if (method === 'GET' && ['/v1/card-entries/', '/v1/card-statements/'].includes(path)) {
      return query === 'cardId=card-e2e';
    }
    if (method === 'GET' && path === '/v1/card-statements/statement-closed') return query === '';
    return method === 'POST' && path === '/v1/card-statements/statement-closed/pay' && query === '';
  }

  private rotateAccessToken(): void {
    this.currentAccessToken = randomUUID();
  }

  private authResponse() {
    return {
      accessToken: this.currentAccessToken,
      accessTokenExpiresAt: '2026-10-08T18:00:00Z',
      user: { id: 'user-e2e', email: expectedLogin.email, displayName: 'Browser User' },
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

  private corsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': appOrigin,
      Vary: 'Origin',
    };
  }

  private json(
    response: ServerResponse,
    body: unknown,
    status = 200,
    setCookie?: string | false,
  ): void {
    response.writeHead(status, {
      ...(setCookie === false ? {} : this.corsHeaders()),
      'Content-Type': 'application/json; charset=utf-8',
      ...(typeof setCookie === 'string' ? { 'Set-Cookie': setCookie } : {}),
    });
    response.end(JSON.stringify(body));
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

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8');
  return text === '' ? null : JSON.parse(text);
}

function getRefreshCookie(request: IncomingMessage): string | null {
  const cookieHeader = request.headers.cookie ?? '';
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${refreshCookieName}=`));
  return cookie ? cookie.slice(refreshCookieName.length + 1) : null;
}

function hasRefreshCookie(request: IncomingMessage): boolean {
  return getRefreshCookie(request) !== null;
}

function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function isCreateExpenseBody(body: unknown): body is {
  dueDate: string;
  label: string;
  expectedAmount: number;
  categoryId: string;
  notes: string | null;
} {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return (
    deepEqual(keys, ['categoryId', 'dueDate', 'expectedAmount', 'label', 'notes']) &&
    typeof record['dueDate'] === 'string' &&
    typeof record['label'] === 'string' &&
    typeof record['expectedAmount'] === 'number' &&
    record['categoryId'] === category.id &&
    (typeof record['notes'] === 'string' || record['notes'] === null)
  );
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(4301, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export const test = base.extend<{ api: BillFolderApiFixture }>({
  api: async ({}, use) => {
    const api = new DeterministicApiBoundary();
    const server = createServer((request, response) => {
      void api.handle(request, response).catch((error: unknown) => {
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }));
      });
    });
    await listen(server);
    try {
      await use(api);
    } finally {
      await close(server);
    }
  },
});

export { expect } from '@playwright/test';
