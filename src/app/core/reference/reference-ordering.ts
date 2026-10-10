import { CheckingAccountResponse } from '../checking-accounts/checking-account.models';
import { CategoryDto } from './reference-data.api';

/** Categories in the order the backend curates, then by name. */
export function compareCategories(left: CategoryDto, right: CategoryDto): number {
  return left.displayOrder - right.displayOrder || left.namePt.localeCompare(right.namePt);
}

/** Primary account first, so it is the default pick in payment forms. */
export function compareCheckingAccounts(
  left: CheckingAccountResponse,
  right: CheckingAccountResponse,
): number {
  return (
    Number(right.isPrimary) - Number(left.isPrimary) || left.bankName.localeCompare(right.bankName)
  );
}
