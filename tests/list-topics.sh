#!/bin/bash
# List topics in Kafka

set -e

echo "=== Kafka Topics ==="
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 \
    --list
