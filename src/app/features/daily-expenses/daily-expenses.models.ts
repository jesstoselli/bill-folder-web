export interface DailyExpenseResponse {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateDailyExpenseRequest {
  readonly date: string;
  readonly label: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly accountId: string;
  readonly notes: string | null;
}

export interface UpdateDailyExpenseRequest {
  readonly date?: string | null;
  readonly label?: string | null;
  readonly amount?: number | null;
  readonly categoryId?: string | null;
  readonly accountId?: string | null;
  readonly notes?: string | null;
}
