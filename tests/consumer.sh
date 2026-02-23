#!/bin/bash
# Consumer script to read messages from Kafka signals topic

set -e

TOPIC=${1:-signals}
MAX_MESSAGES=${2:-10}

echo "=== Kafka Consumer for topic: $TOPIC ==="
echo "Reading last $MAX_MESSAGES messages..."
echo ""

docker compose exec -T kafka kafka-console-consumer \
    --bootstrap-server localhost:9092 \
    --topic "$TOPIC" \
    --from-beginning \
    --max-messages "$MAX_MESSAGES" \
    --timeout-ms 30000
