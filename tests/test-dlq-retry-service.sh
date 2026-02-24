#!/bin/bash
# Test script for DLQ Retry Service

set -e

echo "=== Testing DLQ Retry Service ==="
echo ""

# 1. Check if service is running
echo "Step 1: Checking if dlq_retry_service is running..."
if docker ps | grep -q dlq_retry_service; then
  echo "Service is running"
else
  echo "Service not running. Starting..."
  docker compose up -d dlq_retry_service
  sleep 5
fi
echo ""

# 2. Send invalid message to mail topic
echo "Step 2: Sending invalid message to 'mails' topic..."
echo 'INVALID JSON TEST' | \
docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic mails
echo "✓ Invalid message sent to mails topic"
echo ""

# 3. Wait for it to appear in DLQ
echo "Step 3: Waiting 5 seconds for message to reach mail_dlq..."
sleep 5
echo ""

# 4. Check mail_dlq
echo "Step 4: Checking mail_dlq..."
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic mail_dlq \
    --from-beginning \
    --max-messages 1 \
    --timeout-ms 3000 \
    --property print.headers=true \
    2>/dev/null | head -5 || echo "No messages in mail_dlq yet"
echo ""

# 5. Check dlq_retry_service logs
echo "Step 5: Checking dlq_retry_service logs (last 30 lines)..."
docker compose logs --tail 30 dlq_retry_service | grep -A 10 "Processing DLQ" || echo "No retry attempts yet"
echo ""

# 6. Info about retry timing
echo "Retry Schedule:"
echo "   - Retry 1: Immediate"
echo "   - Retry 2: After 30 seconds"
echo "   - Retry 3: After 2 minutes"
echo "   - Discord notification: After ~7 minutes (if all retries fail)"
echo ""
echo "To see live logs of the retry service:"
echo "   docker compose logs -f dlq_retry_service"
echo ""
echo "=== Test Complete ==="
