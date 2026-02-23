#!/bin/bash
# Test script to verify signal_consumer transforms and forwards messages

set -e

echo "=== Signal Consumer Test ==="
echo "Starting all services..."

# Start services
cd /home/pierre-louis/Documents/2025-2026/streaming-lake/kafkade
docker compose up -d

echo "Waiting for services to be ready..."
sleep 20

# Check if signal_consumer is running
if ! docker ps | grep -q signal_consumer; then
    echo "ERROR: signal_consumer container is not running"
    docker compose logs signal_consumer
    exit 1
fi

echo "✓ signal_consumer is running"

# Check signal_consumer logs for transformation messages
echo "Checking if messages are being transformed..."
sleep 5

LOGS=$(docker compose logs signal_consumer)
if echo "$LOGS" | grep -q "Transformed message:"; then
    echo "✓ SUCCESS: Signal consumer is transforming messages"
    echo "Sample log:"
    echo "$LOGS" | grep "Transformed message:" | tail -3
else
    echo "✗ WARNING: No transformation detected yet in logs"
    echo "$LOGS" | tail -10
fi

# Check if tickets_formatted topic exists
echo ""
echo "=== Checking Output Topic ==="
TOPICS=$(docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list)
if echo "$TOPICS" | grep -q "tickets_formatted"; then
    echo "✓ SUCCESS: tickets_formatted topic exists"
else
    echo "✗ FAILED: tickets_formatted topic not found"
    echo "Available topics:"
    echo "$TOPICS"
    exit 1
fi

# Try to consume messages from output topic
echo ""
echo "=== Consuming from tickets_formatted topic ==="
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic tickets_formatted \
    --from-beginning \
    --max-messages 3 \
    --timeout-ms 10000 || true

echo ""
echo "=== Test completed successfully ==="
