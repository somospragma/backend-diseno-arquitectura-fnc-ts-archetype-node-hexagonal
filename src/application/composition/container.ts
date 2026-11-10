import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SNSClient } from '@aws-sdk/client-sns';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { AccountDynamoRepository } from '@infrastructure/driven-adapters/dynamodb/account-dynamo-repository.js';
import { DynamoIdempotencyStore } from '@infrastructure/driven-adapters/dynamodb/dynamo-idempotency-store.js';
import { SnsNotificationPublisher } from '@infrastructure/driven-adapters/sns/sns-notification-publisher.js';
import { EventBridgePublisher } from '@infrastructure/driven-adapters/eventbridge/eventbridge-publisher.js';
import {
  CreateAccountUseCase,
  GetAccountUseCase,
  UpdateAccountUseCase,
  PatchAccountUseCase,
  DeleteAccountUseCase,
  SearchAccountsUseCase,
} from '@domain/usecases/account-usecases.js';

/**
 * Composition root (wiring). Se construye UNA vez a nivel de modulo y se reutiliza
 * entre invocaciones calientes; NO guarda estado de negocio mutable (SRV-O-004),
 * solo clientes AWS y use cases stateless. Los clientes AWS fuera del handler
 * reutilizan conexiones (mejor cold path).
 */
const env = (k: string, def?: string): string => {
  const v = process.env[k] ?? def;
  if (v === undefined) throw new Error(`Missing env var: ${k}`);
  return v;
};

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});
const eventBridge = new EventBridgeClient({});

const repository = new AccountDynamoRepository(dynamo, env('ACCOUNTS_TABLE', 'accounts'));
const idempotencyStore = new DynamoIdempotencyStore(
  dynamo,
  env('IDEMPOTENCY_TABLE', 'idempotency'),
);
const notificationPublisher = new SnsNotificationPublisher(
  sns,
  env('ACCOUNTS_TOPIC_ARN', 'arn:topic'),
);
const eventPublisher = new EventBridgePublisher(eventBridge, env('EVENT_BUS', 'default'));

export const container = {
  repository,
  idempotencyStore,
  notificationPublisher,
  eventPublisher,
  useCases: {
    create: new CreateAccountUseCase(repository),
    get: new GetAccountUseCase(repository),
    update: new UpdateAccountUseCase(repository),
    patch: new PatchAccountUseCase(repository),
    delete: new DeleteAccountUseCase(repository),
    search: new SearchAccountsUseCase(repository),
  },
};

export type Container = typeof container;
