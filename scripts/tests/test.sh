#!/bin/bash
# Test script to verify signal_simulator sends messages to Kafka

set -e

echo "=== Signal Simulator Test ==="
echo "Starting Kafka and signal_simulator services..."

# Start services
docker compose up -d

echo "Waiting for services to be ready..."
sleep 15

# Check if signal_simulator is running
if ! docker ps | grep -q signal_simulator; then
    echo "ERROR: signal_simulator container is not running"
    docker compose logs signal_simulator
    exit 1
fi

echo "signal_simulator is running"

# Check signal_simulator logs for message sending
echo "Checking if messages are being sent..."
sleep 5

LOGS=$(docker compose logs signal_simulator)
if echo "$LOGS" | grep -q "Sent message:"; then
    echo "✓ SUCCESS: Signal simulator is sending messages"
    echo "Sample log:"
    echo "$LOGS" | grep "Sent message:" | tail -3
else
    echo "✗ FAILED: No messages detected in logs"
    echo "$LOGS"
    exit 1
fi

# Try to consume messages from Kafka
echo ""
echo "=== Consuming messages from Kafka ==="
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic signals \
    --from-beginning \
    --max-messages 5 \
    --timeout-ms 10000 || true

echo ""
echo "=== Test completed successfully ==="
