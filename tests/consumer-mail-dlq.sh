#!/bin/bash
# Simple consumer for DLQ with headers

set -e

echo "=== Consuming from mail_dlq (Dead Letter Queue) ==="
echo "Press Ctrl+C to stop"
echo ""

docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic mail_dlq \
    --from-beginning \
    --property print.headers=true \
    --property print.key=true \
    --property print.timestamp=true

