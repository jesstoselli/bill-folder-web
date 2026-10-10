export interface CheckingAccountResponse {
  readonly id: string;
  readonly bankName: string;
  readonly branch: string | null;
  readonly accountNumber: string | null;
  readonly initialBalance: number;
  readonly isPrimary: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCheckingAccountRequest {
  readonly bankName: string;
  readonly branch: string;
  readonly accountNumber: string;
  readonly initialBalance: number;
  readonly isPrimary: boolean;
}

export type UpdateCheckingAccountRequest = Partial<CreateCheckingAccountRequest>;
