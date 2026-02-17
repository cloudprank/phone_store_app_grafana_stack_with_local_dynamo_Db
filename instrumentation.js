const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
  // Keep sending traces to Jaeger
  traceExporter: new OTLPTraceExporter(),
  
  // NEW: Expose metrics on port 9464 for Prometheus to scrape
  metricReader: new PrometheusExporter({ port: 9464 }),
  
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false }
    })
  ],
});

sdk.start();
console.log('OTEL is active! Traces going to Jaeger. Metrics exposed on port 9464.');