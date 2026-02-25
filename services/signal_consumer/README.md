# Signal Consumer

## Architecture

TypeScript application using KafkaJS to consume signal messages from a Kafka topic, transform them to ticket format, and produce to another topic.

### Tech Stack
- **TypeScript** with Node.js 20
- **KafkaJS** for Kafka consumer and producer

## Configuration

Environment variables:
- `KAFKA_BROKER`: Kafka broker address (default: `localhost:9092`)
- `INPUT_KAFKA_TOPIC`: Input topic name (default: `signals`)
- `OUTPUT_KAFKA_TOPIC`: Output topic name (default: `tickets_formatted`)

## Message Transformation

### Input Schema
```json
{
  "signal_id": "uuid",
  "sender": "Full Name",
  "message": "Lorem ipsum text",
  "date": "ISO 8601 timestamp",
  "files": ["filename1.ext", "filename2.ext"],
  "signal_instance": "uuid",
  "emojis": ["😀", "🚀"]
}
```

### Output Schema
```json
{
  "id": "uuid",
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
# Test consumer transformation
./scripts/tests/test-consumer.sh

# Verify message transformation
./scripts/tests/verify-transformation.sh

# Consume formatted messages
./scripts/tests/consumer-formatted.sh [max_messages]
```

## Architecture Decisions

1. **Consumer Group**: Uses `signal-consumer-group` for parallel processing capability
2. **At-least-once delivery**: Consumer commits offsets after successful produce to output topic
3. **Error isolation**: Errors in processing one message don't stop the consumer
4. **Field mapping**: Renames `signal_id` to `id`, removes `signal_instance` and `emojis` fields
5. **Graceful shutdown**: Handles SIGTERM/SIGINT for proper disconnection
6. **Connection retry**: 10 retries with exponential backoff for resilience
7. **fromBeginning: false**: Only processes new messages, not historical data


