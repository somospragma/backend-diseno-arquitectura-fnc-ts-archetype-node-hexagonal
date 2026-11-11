/**
 * Mock unificado de AWS Lambda Powertools para Jest.
 *
 * Powertools publica paquetes dual (CJS/ESM); bajo ts-jest en modo ESM la
 * resolucion cae al build CJS y rompe con "Class extends value undefined" por
 * interop. Como en las pruebas NO validamos el transporte real de logs/metricas
 * /trazas (eso es responsabilidad del runtime de Lambda, no del codigo de
 * negocio), reemplazamos las tres clases por dobles ligeros. Esto mantiene
 * observability.ts importable y cubierto sin acoplar los tests al SDK real.
 */
export class Logger {
  constructor(_opts?: unknown) {}
  info(..._args: unknown[]): void {}
  warn(..._args: unknown[]): void {}
  error(..._args: unknown[]): void {}
  debug(..._args: unknown[]): void {}
  addContext(..._args: unknown[]): void {}
}

export class Metrics {
  constructor(_opts?: unknown) {}
  addMetric(..._args: unknown[]): void {}
  publishStoredMetrics(..._args: unknown[]): void {}
  addDimension(..._args: unknown[]): void {}
}

export class Tracer {
  constructor(_opts?: unknown) {}
  getSegment(): unknown {
    return undefined;
  }
  putAnnotation(..._args: unknown[]): void {}
  captureAWSv3Client<T>(client: T): T {
    return client;
  }
}

export enum MetricUnit {
  Count = 'Count',
  Milliseconds = 'Milliseconds',
  Seconds = 'Seconds',
}
