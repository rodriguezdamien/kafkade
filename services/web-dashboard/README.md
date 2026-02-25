# Kafka Queue Dashboard

A Next.js web dashboard for monitoring Kafka topics and messages.

## Features

- View all Kafka topics
- Inspect messages from any topic
- View message headers and metadata
- Real-time refresh
- Tailwind CSS + Shadcn UI

## Environment Variables

- `KAFKA_BROKER` - Kafka broker address (default: kafka:9092)

## Development

```bash
pnpm install
pnpm dev
```

## Docker

```bash
docker compose up -d web-dashboard
```

Access at: http://localhost:3000
