#!/bin/bash
# Test script for Signal Consumer Dead Letter Queue

set -e

echo "=== Testing Signal Consumer DLQ ==="
echo ""

# 1. Check if topic exists
echo "Step 1: Checking if signals_dql topic exists..."
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 \
    --list | grep -q "signals_dql" && echo "✓ DLQ topic exists" || echo "✗ DLQ topic not found (will be auto-created)"
echo ""

# 2. Send an invalid message to trigger DLQ
echo "Step 2: Sending invalid message to 'signals' topic..."
echo '{"invalid": "message without required fields"}' | \
docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic signals
echo "✓ Invalid message sent"
echo ""

# 3. Wait a bit for processing
echo "Step 3: Waiting 3 seconds for processing..."
sleep 3
echo ""

# 4. Check signal_consumer logs
echo "Step 4: Checking signal_consumer logs for errors..."
docker compose logs --tail 20 signal_consumer | grep -i "error\|dlq" || echo "No error logs found yet"
echo ""

# 5. Read from DLQ
echo "Step 5: Reading messages from DLQ (signals_dql)..."
echo "Messages in DLQ:"
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic signals_dql \
    --from-beginning \
    --max-messages 10 \
    --timeout-ms 5000 \
    --property print.headers=true \
    --property print.key=true \
    --property print.timestamp=true \
    2>/dev/null || echo "No messages in DLQ yet"

echo ""
echo "=== Test Complete ==="
