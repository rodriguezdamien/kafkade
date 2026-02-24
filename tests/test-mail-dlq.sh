#!/bin/bash
# Test script for Mail Formatter Dead Letter Queue

set -e

echo "=== Testing Mail Formatter DLQ ==="
echo ""

# 1. Check if topic exists
echo "Step 1: Checking if mail_dlq topic exists..."
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 \
    --list | grep -q "mail_dlq" && echo "✓ DLQ topic exists" || echo "✗ DLQ topic not found (will be auto-created)"
echo ""

# 2. Send an invalid message to trigger DLQ
echo "Step 2: Sending invalid message to 'mails' topic..."
echo '{"invalid": "message without required fields"}' | \
docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic mails
echo "Invalid message sent"
echo ""

# 3. Wait a bit for processing
echo "Step 3: Waiting 3 seconds for processing..."
sleep 3
echo ""

# 4. Check mail_formatter logs
echo "Step 4: Checking mail_formatter logs for errors..."
docker compose logs --tail 20 mail_formatter | grep -i "error\|dlq" || echo "No error logs found yet"
echo ""

# 5. Read from DLQ
echo "Step 5: Reading messages from DLQ (mail_dlq)..."
echo "Messages in DLQ:"
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic mail_dlq \
    --from-beginning \
    --max-messages 10 \
    --timeout-ms 5000 \
    --property print.headers=true \
    --property print.key=true \
    --property print.timestamp=true \
    2>/dev/null || echo "No messages in DLQ yet"

echo ""
echo "=== Test Complete ==="
