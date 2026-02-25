#!/bin/bash
# Simple consumer for Signal DLQ with headers

set -e

echo "=== Consuming from signals_dql (Dead Letter Queue) ==="
echo "Press Ctrl+C to stop"
echo ""

docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic signals_dql \
    --from-beginning \
    --property print.headers=true \
    --property print.key=true \
    --property print.timestamp=true
