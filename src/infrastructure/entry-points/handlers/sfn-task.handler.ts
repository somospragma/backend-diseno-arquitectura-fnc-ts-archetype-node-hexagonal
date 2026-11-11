import { container } from '@application/composition/container.js';
import type { IIdempotencyStore } from '@domain/ports/messaging.js';
import type { GetAccountUseCase } from '@domain/usecases/account-usecases.js';
import { maskAccount } from '@infrastructure/helpers/masking.js';
import { logger } from '@infrastructure/helpers/observability.js';

const DEDUPE_TTL_SECONDS = 24 * 60 * 60; // 24h (ventana del workflow)

/**
 * Input de un estado Task de Step Functions. A diferencia de API GW/SQS, aqui NO
 * hay envoltura de evento HTTP ni Records: el estado entrega directamente el JSON
 * que definiste en el ASL (tras InputPath/Parameters). El campo taskToken solo
 * llega en integraciones .waitForTaskToken (callback); en Task sincrona no viene.
 */
export interface SfnTaskInput {
  /** Id de negocio del elemento que procesa este paso del workflow. */
  accountId: string;
  /** Id de ejecucion/paso para deduplicar reintentos del estado (SRV-O-002). */
  executionId: string;
  taskToken?: string;
}

/** Salida del estado: se convierte en el input del siguiente estado del ASL. */
export interface SfnTaskOutput {
  accountId: string;
  status: string;
  processed: boolean;
}

export interface SfnDeps {
  idempotencyStore: IIdempotencyStore;
  get: GetAccountUseCase;
}

/**
 * Task de Step Functions (adaptador de entrada de ORQUESTACION). Un paso del
 * workflow: valida/procesa un elemento y devuelve el resultado para el siguiente
 * estado. Idempotente por executionId (los reintentos declarados con Retry en el
 * ASL no duplican el efecto). Los errores se propagan crudos a proposito: es el
 * bloque Catch/Retry del ESTADO (no un try/catch en codigo) quien decide el
 * reintento o la transicion de fallo.
 */
export async function processSfnTask(input: SfnTaskInput, deps: SfnDeps): Promise<SfnTaskOutput> {
  const isFirst = await deps.idempotencyStore.markIfFirst(
    `sfn:${input.executionId}:${input.accountId}`,
    DEDUPE_TTL_SECONDS,
  );
  if (!isFirst) {
    logger.info('paso de workflow ya procesado; se omite (idempotencia)', {
      executionId: input.executionId,
      accountId: input.accountId,
    });
  }
  const account = await deps.get.execute(input.accountId);
  logger.info('task de workflow procesada', { account: maskAccount(account) });
  return { accountId: account.id, status: account.status, processed: isFirst };
}

/** Entry-point Lambda invocado por un estado Task del ASL. */
export const handler = (input: SfnTaskInput): Promise<SfnTaskOutput> =>
  processSfnTask(input, {
    idempotencyStore: container.idempotencyStore,
    get: container.useCases.get,
  });
