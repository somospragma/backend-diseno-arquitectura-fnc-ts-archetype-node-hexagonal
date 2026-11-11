import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';

/**
 * Observabilidad con AWS Lambda Powertools (OBS-*): logging estructurado JSON con
 * correlation id, metricas EMF y tracing X-Ray. Instancias a nivel de modulo
 * (reutilizadas entre invocaciones para el logger/tracer; NO guardan estado de
 * negocio, solo config — compatible con SRV-O-004).
 */
export const logger = new Logger({ serviceName: 'accounts-serverless' });

/**
 * API de observabilidad que el arquetipo ofrece a los handlers.
 * PENDIENTE: ningun handler la instrumenta todavia (metricas EMF y tracing X-Ray
 * no estan cableados); se deja exportada para que cada equipo la use.
 * @public
 */
export const metrics = new Metrics({
  namespace: 'Pragma/Accounts',
  serviceName: 'accounts-serverless',
});

/**
 * Ver nota en `metrics`: tracing disponible pero sin instrumentar aun.
 * @public
 */
export const tracer = new Tracer({ serviceName: 'accounts-serverless' });
