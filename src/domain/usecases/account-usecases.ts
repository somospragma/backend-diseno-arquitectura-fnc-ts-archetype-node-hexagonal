import type { Account, AccountSearchCriteria } from '../model/account.js';
import { AccountNotFoundException } from '../model/errors.js';
import type { IAccountRepository } from '../ports/account-repository.js';

/**
 * Casos de uso de cuentas. Clases planas framework-free: sin imports de AWS,
 * infra ni handlers. Reciben el puerto por constructor (inyeccion). La capa de
 * composicion (application) los cablea con los adapters concretos.
 */

export interface CreateAccountInput {
  holderName: string;
  email: string;
  accountType: string;
  initialBalance: number;
}

const MAX_LIMIT = 100;

export class CreateAccountUseCase {
  constructor(private readonly repo: IAccountRepository) {}

  async execute(input: CreateAccountInput): Promise<Account> {
    const now = new Date().toISOString();
    const account: Account = {
      id: crypto.randomUUID(),
      holderName: input.holderName,
      email: input.email,
      accountType: input.accountType,
      balance: input.initialBalance,
      status: 'ACTIVE',
      createdAt: now,
    };
    return this.repo.save(account);
  }
}

export class GetAccountUseCase {
  constructor(private readonly repo: IAccountRepository) {}

  async execute(id: string): Promise<Account> {
    const found = await this.repo.findById(id);
    if (!found) {
      throw new AccountNotFoundException(id);
    }
    return found;
  }
}

export class UpdateAccountUseCase {
  constructor(private readonly repo: IAccountRepository) {}

  /** Reemplazo total (PUT), idempotente. Preserva id y createdAt del existente. */
  async execute(id: string, replacement: Omit<Account, 'id' | 'createdAt'>): Promise<Account> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AccountNotFoundException(id);
    }
    return this.repo.save({ ...replacement, id: existing.id, createdAt: existing.createdAt });
  }
}

export class PatchAccountUseCase {
  constructor(private readonly repo: IAccountRepository) {}

  /** Actualizacion parcial (PATCH): solo aplica los campos presentes. */
  async execute(id: string, patch: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AccountNotFoundException(id);
    }
    const merged: Account = { ...existing };
    if (patch.holderName !== undefined) merged.holderName = patch.holderName;
    if (patch.email !== undefined) merged.email = patch.email;
    if (patch.accountType !== undefined) merged.accountType = patch.accountType;
    if (patch.status !== undefined) merged.status = patch.status;
    if (patch.balance !== undefined) merged.balance = patch.balance;
    return this.repo.save(merged);
  }
}

export class DeleteAccountUseCase {
  constructor(private readonly repo: IAccountRepository) {}

  async execute(id: string): Promise<void> {
    if (!(await this.repo.existsById(id))) {
      throw new AccountNotFoundException(id);
    }
    await this.repo.deleteById(id);
  }
}

export class SearchAccountsUseCase {
  constructor(private readonly repo: IAccountRepository) {}

  /** Busqueda con tope duro: nunca colecciones ilimitadas (API-O-005). */
  async execute(criteria: AccountSearchCriteria, limit = 20): Promise<Account[]> {
    const capped = Math.min(Math.max(limit, 1), MAX_LIMIT);
    return this.repo.search(criteria, capped);
  }
}
