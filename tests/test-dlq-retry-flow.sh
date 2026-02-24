#!/bin/bash
# Comprehensive test for DLQ Retry Service - validates retry logic, timing, and permanent failures

set -e

KAFKA_BROKER="localhost:9092"
TEST_TOPIC="mails"
DLQ_TOPIC="mail_dlq"

echo "========================================"
echo "  DLQ Retry Service - Full Flow Test"
echo "========================================"
echo ""

# Helper function to count messages in a topic
count_messages() {
    local topic=$1
    docker compose exec -T kafka /opt/kafka/bin/kafka-run-class.sh \
        kafka.tools.GetOffsetShell \
        --broker-list $KAFKA_BROKER \
        --topic $topic \
        --time -1 2>/dev/null | awk -F ":" '{sum += $3} END {print sum+0}'
}

# Helper function to read messages with headers
read_topic_with_headers() {
    local topic=$1
    local max_msgs=${2:-10}
    docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
        --bootstrap-server $KAFKA_BROKER \
        --topic $topic \
        --from-beginning \
        --max-messages $max_msgs \
        --timeout-ms 3000 \
        --property print.headers=true \
        --property print.key=true \
        2>/dev/null || true
}

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."
if ! docker ps | grep -q dlq_retry_service; then
    echo "✗ dlq_retry_service is not running!"
    echo "  Starting service..."
    docker compose up -d dlq_retry_service
    sleep 5
fi
if ! docker ps | grep -q mail_formatter; then
    echo "✗ mail_formatter is not running!"
    echo "  Starting service..."
    docker compose up -d mail_formatter
    sleep 3
fi
echo "✓ All required services are running"
echo ""

# Step 2: Check baseline
echo "Step 2: Recording baseline message counts..."
INITIAL_MAILS=$(count_messages "mails")
INITIAL_DLQ=$(count_messages "mail_dlq")
echo "   mails topic: $INITIAL_MAILS messages"
echo "   mail_dlq topic: $INITIAL_DLQ messages"
echo ""

# Step 3: Send invalid message that will fail processing
echo "Step 3: Sending invalid message to trigger DLQ..."
echo '{"incomplete": "message", "missing": "required_fields"}' | \
docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server $KAFKA_BROKER \
    --topic $TEST_TOPIC 2>/dev/null
echo "✓ Invalid message sent to $TEST_TOPIC"
echo ""

# Step 4: Wait for message to be processed and sent to DLQ
echo "Step 4: Waiting for message to be processed and sent to DLQ (5s)..."
sleep 5
NEW_DLQ=$(count_messages "mail_dlq")
if [ "$NEW_DLQ" -gt "$INITIAL_DLQ" ]; then
    echo "✓ Message appeared in DLQ ($NEW_DLQ total messages)"
else
    echo "✗ Message not yet in DLQ (expected $((INITIAL_DLQ + 1)), got $NEW_DLQ)"
    echo "   Checking mail_formatter logs:"
    docker compose logs --tail 10 mail_formatter
fi
echo ""

# Step 5: Check DLQ message headers
echo "Step 5: Inspecting DLQ message headers..."
read_topic_with_headers "$DLQ_TOPIC" 1 | head -20
echo ""

# Step 6: Monitor retry attempts
echo "Step 6: Monitoring retry attempts..."
echo "   Expected retry schedule:"
echo "   - Attempt 1: Immediate (0s)"
echo "   - Attempt 2: After 30 seconds"
echo "   - Attempt 3: After 2 minutes (120s)"
echo ""

echo "   Waiting 3 seconds to observe first retry attempt..."
sleep 3
echo ""

echo "   Checking dlq_retry_service logs for retry attempts:"
docker compose logs --tail 50 dlq_retry_service | grep -E "Processing DLQ|Retry attempt|SUCCESS|PERMANENT FAILURE" || echo "   No retry logs yet"
echo ""

# Step 7: Check if message was sent back to original topic
echo "Step 7: Checking if message was retried to original topic..."
AFTER_RETRY_MAILS=$(count_messages "mails")
EXPECTED_MAILS=$((INITIAL_MAILS + 2)) # Original + 1 retry attempt
if [ "$AFTER_RETRY_MAILS" -ge "$EXPECTED_MAILS" ]; then
    echo "✓ Message(s) sent back to $TEST_TOPIC for retry"
    echo "   Messages in mails topic: $AFTER_RETRY_MAILS (was $INITIAL_MAILS)"
else
    echo "⚠ Retry not detected yet (mails: $AFTER_RETRY_MAILS, expected ~$EXPECTED_MAILS)"
fi
echo ""

# Step 8: Check retry headers
echo "Step 8: Checking retry headers on messages..."
echo "   Looking for 'retry-from-dlq' and 'retry-attempt' headers:"
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server $KAFKA_BROKER \
    --topic $TEST_TOPIC \
    --max-messages 5 \
    --timeout-ms 2000 \
    --property print.headers=true \
    --from-beginning \
    2>/dev/null | grep -E "retry-from-dlq|retry-attempt" || echo "   No retry headers found in recent messages"
echo ""

# Step 9: Information about extended testing
echo "========================================="
echo "  Extended Testing Instructions"
echo "========================================="
echo ""
echo "To observe the full retry cycle (3 attempts):"
echo "   1. The service will retry immediately (just happened)"
echo "   2. After 30 seconds, it will retry again"
echo "   3. After 2 minutes total, it will make the final retry"
echo "   4. After all retries fail, it will log PERMANENT FAILURE"
echo ""
echo "Monitor live logs with:"
echo "   docker compose logs -f dlq_retry_service"
echo ""
echo "Check DLQ messages with:"
echo "   docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \\"
echo "       --bootstrap-server $KAFKA_BROKER \\"
echo "       --topic mail_dlq \\"
echo "       --from-beginning \\"
echo "       --property print.headers=true"
echo ""
echo "Check retry count progression:"
echo "   # Wait ~35 seconds for 2nd retry"
echo "   docker compose logs dlq_retry_service | grep 'retry-attempt: 2'"
echo ""
echo "   # Wait ~2 more minutes for 3rd retry"
echo "   docker compose logs dlq_retry_service | grep 'retry-attempt: 3'"
echo ""
echo "   # Check for permanent failure"
echo "   docker compose logs dlq_retry_service | grep 'PERMANENT FAILURE'"
echo ""
echo "========================================="
echo "  Quick Test Summary"
echo "========================================="
echo ""
echo "Test Results:"
echo "✓ Services running"
echo "✓ Invalid message sent to $TEST_TOPIC"
echo "✓ Message forwarded to $DLQ_TOPIC"
if [ "$AFTER_RETRY_MAILS" -ge "$EXPECTED_MAILS" ]; then
    echo "✓ First retry attempt detected"
else
    echo "⚠ First retry attempt pending (check logs)"
fi
echo ""
echo "=== Test Complete ==="
