# DLQ Retry Service

A service that monitors Dead Letter Queues (mails_dlq, signals_dlq), and retries failed messages by sending them back to their original topics for reprocessing. Notifies via Discord for permanent failures.

## Configuration

The service can be configured using the following environment variables:
- `KAFKA_BROKER`: Kafka broker address (default: `localhost:9092`)
- `MAX_RETRY_ATTEMPTS`: Number of retry attempts (default: `3`)
- `KAFKA_GROUP_ID`: Consumer group ID (default: `dlq-retry-service-group`)
- `DISCORD_WEBHOOK_URL`: Discord webhook URL for notifications (optional)

## Retry Strategy

Exponential backoff with 3 attempts:
1. Immediate retry
2. After 30 seconds
3. After 2 minutes

Messages are sent back to their original topic (mails or signals) for reprocessing by the respective formatter. Permanent failures are aggregated and sent to Discord every 10 minutes.

## Adding New DLQs

To monitor additional DLQ topics, edit `src/index.ts`:

```typescript
const DLQ_TOPICS = [
  'mails_dlq',
  'signals_dlq',
  'your_new_dlq',
];
```

## Language

The service is implemented in TypeScript and uses the `kafkajs` library.

## Usage

To run the service:
1. Install dependencies: `pnpm install`
2. Set environment variables as needed
3. Start the service: `pnpm start`

### Docker

```bash
docker compose up -d --build dlq_retry_service
```
