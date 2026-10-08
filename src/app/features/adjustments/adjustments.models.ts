export type CycleAdjustmentType = 'inflow' | 'outflow';

export interface CycleAdjustmentResponse {
  readonly id: string;
  readonly type: CycleAdjustmentType;
  readonly label: string;
  readonly amount: number;
  readonly date: string;
  readonly sourceSavingsTransactionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCycleAdjustmentRequest {
  readonly type: CycleAdjustmentType;
  readonly label: string;
  readonly amount: number;
  readonly date: string;
  readonly sourceSavingsTransactionId: string | null;
}

export interface UpdateCycleAdjustmentRequest {
  readonly type?: CycleAdjustmentType | null;
  readonly label?: string | null;
  readonly amount?: number | null;
  readonly date?: string | null;
  readonly sourceSavingsTransactionId?: string | null;
}
