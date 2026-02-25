#!/bin/bash
# Consumer script for individual ticket topics

set -e

TICKET_ID=${1}

if [ -z "$TICKET_ID" ]; then
    echo "Usage: $0 <ticket_id>"
    echo ""
    echo "Example: $0 12345"
    echo ""
    echo "Available ticket topics:"
    docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
        --bootstrap-server localhost:9092 \
        --list | grep -E "^ticket-" || echo "No ticket topics found"
    exit 1
fi

TOPIC_NAME="ticket-${TICKET_ID}"
MAX_MESSAGES=${2:-10}

echo "=== Kafka Consumer for $TOPIC_NAME ==="
echo "Reading last $MAX_MESSAGES messages..."
echo ""

docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic "$TOPIC_NAME" \
    --from-beginning \
    --max-messages "$MAX_MESSAGES" \
    --timeout-ms 30000
