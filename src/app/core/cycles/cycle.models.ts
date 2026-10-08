export interface CycleResponse {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly label: string;
  readonly isRecurrenceGenerated: boolean;
  readonly isCurrent: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
