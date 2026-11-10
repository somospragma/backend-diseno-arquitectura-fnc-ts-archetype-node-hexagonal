import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { IIdempotencyStore } from '@domain/ports/messaging.js';

/**
 * Store de idempotencia sobre DynamoDB (SRV-O-002). markIfFirst hace un PutItem
 * condicional (attribute_not_exists) con TTL: la primera vez inserta y devuelve
 * true; en reprocesos la condicion falla y devuelve false para saltar el efecto.
 * Es el equivalente serverless del SETNX de Redis, sin dependencia de Redis.
 */
export class DynamoIdempotencyStore implements IIdempotencyStore {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async markIfFirst(key: string, ttlSeconds: number): Promise<boolean> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { id: key, expiresAt },
          ConditionExpression: 'attribute_not_exists(id)',
        }),
      );
      return true;
    } catch (e) {
      // ConditionalCheckFailedException => clave ya vista (duplicado)
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw e;
    }
  }
}
