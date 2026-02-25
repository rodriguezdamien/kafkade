# Signal Simulator

## Architecture

TypeScript application using KafkaJS to produce fake signal messages to a Kafka topic. Uses Faker.js for data generation.

### Tech Stack
- **TypeScript** with Node.js 20
- **KafkaJS** for Kafka producer client
- **@faker-js/faker** for random data generation

## Configuration

Environment variables:
- `KAFKA_BROKER`: Kafka broker address (default: `localhost:9092`)
- `KAFKA_TOPIC`: Topic name (default: `signals`)
- `MESSAGE_INTERVAL`: Seconds between messages (default: `1`)

## Message Schema

```json
{
  "signal_id": "uuid",
  "sender": "Full Name",
  "message": "Lorem ipsum text",
  "date": "ISO 8601 timestamp",
  "files": ["filename1.ext", "filename2.ext"]
}
```

## Usage

### Local Development
```bash
pnpm install
pnpm run dev
```

### Docker
```bash
docker compose up
```

### Testing
```bash
# Run full test suite
./test.sh

# Consume messages
./consumer.sh [topic] [max_messages]

# List topics
./list-topics.sh
```

## Architecture Decisions

1. **KafkaJS over rdkafka**: Pure JS implementation, no native dependencies, easier Docker builds
2. **Producer-only design**: Lightweight, single responsibility
3. **Graceful shutdown**: Handles SIGTERM/SIGINT for proper Kafka disconnection
4. **Connection retry**: 10 retries with exponential backoff for Kafka connection resilience
5. **Multi-stage Docker**: Alpine-based for smaller image size (~200MB vs ~1GB)
