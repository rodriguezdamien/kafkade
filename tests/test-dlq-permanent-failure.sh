#!/bin/bash
# Test permanent failure notification and Discord webhook integration

set -e

echo "========================================"
echo "  DLQ Permanent Failure Test"
echo "========================================"
echo ""

# Check if Discord webhook is configured
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    echo "✓ Discord webhook is configured"
else
    echo "⚠ Discord webhook not configured (set DISCORD_WEBHOOK_URL env var)"
    echo "  Continuing test - will check logs instead"
fi
echo ""

# Step 1: Send multiple failing messages
echo "Step 1: Sending 3 different failing messages to test aggregation..."
for i in {1..3}; do
    echo "{\"test_failure_$i\": \"This will fail\"}" | \
    docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh \
        --bootstrap-server localhost:9092 \
        --topic mails 2>/dev/null
    echo "   Sent test message $i"
    sleep 1
done
echo "✓ Test messages sent"
echo ""

# Step 2: Wait for messages to reach DLQ
echo "Step 2: Waiting 5 seconds for messages to reach DLQ..."
sleep 5
echo ""

# Step 3: Check DLQ
echo "Step 3: Verifying messages in mail_dlq..."
MSG_COUNT=$(docker compose exec -T kafka /opt/kafka/bin/kafka-run-class.sh \
    kafka.tools.GetOffsetShell \
    --broker-list localhost:9092 \
    --topic mail_dlq \
    --time -1 2>/dev/null | awk -F ":" '{sum += $3} END {print sum+0}')
echo "   Messages in DLQ: $MSG_COUNT"
echo ""

# Step 4: Monitor for retry cycles
echo "Step 4: Messages will go through 3 retry attempts..."
echo "   This takes ~3 minutes total per message"
echo "   - Immediate retry (0s)"
echo "   - Second retry (+30s)"
echo "   - Third retry (+2min)"
echo ""
echo "   Monitoring dlq_retry_service for permanent failures..."
echo "   (Will check every 30 seconds for 5 minutes)"
echo ""

for i in {1..10}; do
    sleep 30
    ELAPSED=$((i * 30))
    echo "   [$ELAPSED seconds] Checking for permanent failures..."
    
    FAILURE_COUNT=$(docker compose logs dlq_retry_service 2>/dev/null | grep -c "PERMANENT FAILURE" || echo "0")
    
    if [ "$FAILURE_COUNT" -gt "0" ]; then
        echo "   ✓ Found $FAILURE_COUNT permanent failure(s)!"
        break
    fi
done
echo ""

# Step 5: Check permanent failure logs
echo "Step 5: Checking permanent failure logs..."
docker compose logs dlq_retry_service | grep -A 10 "PERMANENT FAILURE" || echo "   No permanent failures logged yet (may need more time)"
echo ""

# Step 6: Check error aggregation
echo "Step 6: Checking error aggregation (sent every 10 minutes)..."
echo "   Note: Aggregated Discord notifications are sent every 10 minutes"
echo "   Individual permanent failures trigger immediate notifications"
echo ""

# Step 7: Summary
echo "========================================="
echo "  Test Summary"
echo "========================================="
echo ""
echo "Permanent Failure Notifications:"
echo "   1. Immediate alert for each permanent failure (after 3 retries)"
echo "   2. Aggregated summary every 10 minutes"
echo ""
echo "To manually check Discord notifications:"
echo "   - Check your Discord channel for webhook messages"
echo "   - Immediate alerts contain full error details"
echo "   - Aggregated summaries show error counts and timing"
echo ""
echo "To see all failure logs:"
echo "   docker compose logs dlq_retry_service | grep -A 15 'PERMANENT FAILURE'"
echo ""
echo "To test Discord webhook:"
echo "   curl -X POST '$DISCORD_WEBHOOK_URL' \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"content\": \"Test notification from DLQ Retry Service\"}'"
echo ""
echo "=== Test Complete ==="
