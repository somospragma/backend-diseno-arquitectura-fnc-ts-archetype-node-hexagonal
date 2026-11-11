import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Account, AccountSearchCriteria } from '@domain/model/account.js';
import { TechnicalException } from '@domain/model/errors.js';
import type { IAccountRepository } from '@domain/ports/account-repository.js';

/**
 * Adapter DynamoDB del repositorio de cuentas. REGLA CLAVE (DAT-O-008): acceso
 * SIEMPRE por Query sobre la clave; NUNCA Scan (que recorreria toda la tabla).
 * La busqueda por criterios usa un GSI por status con filtro acotado + Limit.
 */
export class AccountDynamoRepository implements IAccountRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly statusIndex = 'status-index',
  ) {}

  async save(account: Account): Promise<Account> {
    try {
      await this.doc.send(new PutCommand({ TableName: this.tableName, Item: account }));
      return account;
    } catch (e) {
      throw new TechnicalException('ACC-500-002', 'DynamoDB save failed', e);
    }
  }

  async findById(id: string): Promise<Account | null> {
    try {
      const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { id } }));
      return (res.Item as Account) ?? null;
    } catch (e) {
      throw new TechnicalException('ACC-500-002', 'DynamoDB get failed', e);
    }
  }

  async deleteById(id: string): Promise<void> {
    try {
      await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { id } }));
    } catch (e) {
      throw new TechnicalException('ACC-500-002', 'DynamoDB delete failed', e);
    }
  }

  async existsById(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  async search(criteria: AccountSearchCriteria, limit: number): Promise<Account[]> {
    // Query por particion del GSI (status). Si no hay status, se exige para no
    // caer en Scan; el caller define un status por defecto o usa otro acceso.
    const status = criteria.status ?? 'ACTIVE';
    const filters: string[] = [];
    const names: Record<string, string> = { '#st': 'status' };
    const values: Record<string, unknown> = { ':st': status };
    if (criteria.accountType) {
      filters.push('#at = :at');
      names['#at'] = 'accountType';
      values[':at'] = criteria.accountType;
    }
    if (criteria.holderName) {
      filters.push('#hn = :hn');
      names['#hn'] = 'holderName';
      values[':hn'] = criteria.holderName;
    }
    try {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: this.statusIndex,
          KeyConditionExpression: '#st = :st',
          FilterExpression: filters.length ? filters.join(' AND ') : undefined,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          Limit: limit,
        }),
      );
      return ((res.Items as Account[]) ?? []).slice(0, limit);
    } catch (e) {
      throw new TechnicalException('ACC-500-002', 'DynamoDB query failed', e);
    }
  }
}
