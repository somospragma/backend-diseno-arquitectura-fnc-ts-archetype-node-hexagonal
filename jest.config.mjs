/**
 * Jest con ts-jest en modo ESM. Gate de cobertura 90% de lineas (equivalente al
 * gate de los arquetipos Java). Se excluyen del coverage el wiring/composicion,
 * los tipos puros y los handlers-shim sin logica (igual criterio que Java).
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    // Powertools publica dual CJS/ESM y bajo ts-jest ESM el build CJS rompe por
    // interop; se sustituye por dobles ligeros (no validamos transporte real de
    // observabilidad en unit tests, eso es del runtime de Lambda).
    '^@aws-lambda-powertools/(logger|metrics|tracer)$': '<rootDir>/test/mocks/powertools.ts',
    // Los alias deben resolverse ANTES que el stripper de `.js`, y como los
    // imports ESM usan sufijo `.js`, se elimina aqui mismo (`(?:\\.js)?$`).
    '^@domain/(.*?)(?:\\.js)?$': '<rootDir>/src/domain/$1',
    '^@infrastructure/(.*?)(?:\\.js)?$': '<rootDir>/src/infrastructure/$1',
    '^@application/(.*?)(?:\\.js)?$': '<rootDir>/src/application/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
    '!src/application/composition/**',
    '!src/domain/model/**',
    '!src/**/*.dto.ts',
  ],
  coverageThreshold: {
    // lines/statements 90% garantizan la cobertura real de la logica. functions 80%
    // porque cada handler expone un wrapper `handler` de una linea (composicion: cablea
    // el container con la funcion core ya testeada); ejercitarlo requeriria mockear AWS
    // y aporta poco. La logica de negocio de cada handler SI esta cubierta via su
    // funcion core exportada (routeApiGateway/processSqsBatch/processSfnTask/...).
    global: { lines: 90, statements: 90, functions: 80, branches: 80 },
  },
  coverageReporters: ['text-summary', 'lcov'],
};
