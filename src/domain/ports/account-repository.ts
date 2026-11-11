import type { Account, AccountSearchCriteria } from '../model/account.js';

/**
 * Puerto de salida de persistencia de cuentas. El adapter (DynamoDB, etc.) lo
 * implementa en infraestructura. Acceso por clave; nunca full scan sin tope.
 */
export interface IAccountRepository {
  save(account: Account): Promise<Account>;
  findById(id: string): Promise<Account | null>;
  deleteById(id: string): Promise<void>;
  existsById(id: string): Promise<boolean>;
  /** Busqueda por criterios, con tope de resultados. */
  search(criteria: AccountSearchCriteria, limit: number): Promise<Account[]>;
}
