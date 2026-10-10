export interface IncomeEntryResponse {
  readonly id: string;
  readonly sourceId: string | null;
  readonly sourceOrigin: string | null;
  readonly expectedAmount: number;
  readonly actualAmount: number | null;
  readonly expectedDate: string;
  readonly actualDate: string | null;
  readonly status: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type IncomeOriginType = 'work' | 'rent' | 'investment' | 'freelance' | 'gift' | 'other';

export interface IncomeSourceResponse {
  readonly id: string;
  readonly origin: string;
  readonly originType: IncomeOriginType;
  readonly defaultAmount: number;
  readonly expectedDay: number;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateIncomeSourceRequest {
  readonly origin: string;
  readonly originType: IncomeOriginType;
  readonly defaultAmount: number;
  readonly expectedDay: number;
  readonly startDate: string;
  readonly endDate: string | null;
}

/**
 * Omitted fields stay as they are, so `endDate: null` would not remove the
 * end date; `clearEndDate: true` does.
 */
export interface UpdateIncomeSourceRequest {
  readonly origin?: string;
  readonly originType?: IncomeOriginType;
  readonly defaultAmount?: number;
  readonly expectedDay?: number;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly clearEndDate?: boolean;
}

export interface CreateIncomeEntryRequest {
  readonly sourceId: string | null;
  readonly expectedAmount: number;
  readonly expectedDate: string;
  readonly notes: string | null;
}

export interface UpdateIncomeEntryRequest {
  readonly sourceId?: string | null;
  readonly expectedAmount?: number | null;
  readonly actualAmount?: number | null;
  readonly expectedDate?: string | null;
  readonly actualDate?: string | null;
  readonly status?: string | null;
  readonly notes?: string | null;
}

export interface ConfirmIncomeReceivedRequest {
  readonly status: 'received';
  readonly actualAmount: number;
  readonly actualDate: string;
}

export interface IncomeGroups {
  readonly expected: readonly IncomeEntryResponse[];
  readonly received: readonly IncomeEntryResponse[];
  readonly late: readonly IncomeEntryResponse[];
  readonly notOccurred: readonly IncomeEntryResponse[];
  readonly other: readonly IncomeEntryResponse[];
}
