#!/bin/bash
# Consumer script for tickets_formatted topic

set -e

MAX_MESSAGES=${1:-10}

echo "=== Kafka Consumer for tickets_formatted topic ==="
echo "Reading last $MAX_MESSAGES messages..."
echo ""

docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic tickets_labelized \
    --from-beginning \
    --max-messages "$MAX_MESSAGES" \
    --timeout-ms 30000
