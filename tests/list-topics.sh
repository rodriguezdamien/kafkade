#!/bin/bash
# List topics in Kafka

set -e

echo "=== Kafka Topics ==="
docker compose exec -T kafka kafka-topics \
    --bootstrap-server localhost:9092 \
    --list
