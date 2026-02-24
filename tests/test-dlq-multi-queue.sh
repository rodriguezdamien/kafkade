#!/bin/bash
# Test both mail_dlq and signal_dlq retry functionality

set -e

echo "========================================"
echo "  Multi-DLQ Test (Mail + Signal)"
echo "========================================"
echo ""

# Helper function
count_dlq_messages() {
    local topic=$1
    docker compose exec -T kafka /opt/kafka/bin/kafka-run-class.sh \
        kafka.tools.GetOffsetShell \
        --broker-list localhost:9092 \
        --topic $topic \
        --time -1 2>/dev/null | awk -F ":" '{sum += $3} END {print sum+0}'
}

# Step 1: Check prerequisites
echo "Step 1: Checking required services..."
SERVICES=("dlq_retry_service" "mail_formatter" "signal_consumer")
ALL_RUNNING=true

for service in "${SERVICES[@]}"; do
    if docker ps | grep -q $service; then
        echo "   ✓ $service is running"
    else
        echo "   ✗ $service is not running - starting..."
        docker compose up -d $service
        ALL_RUNNING=false
    fi
done

if [ "$ALL_RUNNING" = false ]; then
    echo "   Waiting 5 seconds for services to start..."
    sleep 5
fi
echo ""

# Step 2: Record baseline
echo "Step 2: Recording baseline message counts..."
MAIL_DLQ_INITIAL=$(count_dlq_messages "mail_dlq")
SIGNAL_DLQ_INITIAL=$(count_dlq_messages "signal_dlq")
echo "   mail_dlq: $MAIL_DLQ_INITIAL messages"
echo "   signal_dlq: $SIGNAL_DLQ_INITIAL messages"
echo ""

# Step 3: Send failing messages to both topics
echo "Step 3: Sending failing messages to both mails and signals topics..."

echo "   Sending invalid mail message..."
echo '{"invalid": "mail"}' | \
docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic mails 2>/dev/null
echo "   ✓ Invalid mail sent"

sleep 1

echo "   Sending invalid signal message..."
echo '{"invalid": "signal"}' | \
docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic signals 2>/dev/null
echo "   ✓ Invalid signal sent"
echo ""

# Step 4: Wait for DLQ population
echo "Step 4: Waiting 5 seconds for messages to reach DLQs..."
sleep 5
echo ""

# Step 5: Verify both DLQs received messages
echo "Step 5: Verifying DLQ population..."
MAIL_DLQ_AFTER=$(count_dlq_messages "mail_dlq")
SIGNAL_DLQ_AFTER=$(count_dlq_messages "signal_dlq")

echo "   mail_dlq:"
if [ "$MAIL_DLQ_AFTER" -gt "$MAIL_DLQ_INITIAL" ]; then
    echo "      ✓ Received new message(s) ($MAIL_DLQ_INITIAL → $MAIL_DLQ_AFTER)"
else
    echo "      ✗ No new messages ($MAIL_DLQ_AFTER)"
fi

echo "   signal_dlq:"
if [ "$SIGNAL_DLQ_AFTER" -gt "$SIGNAL_DLQ_INITIAL" ]; then
    echo "      ✓ Received new message(s) ($SIGNAL_DLQ_INITIAL → $SIGNAL_DLQ_AFTER)"
else
    echo "      ✗ No new messages ($SIGNAL_DLQ_AFTER)"
fi
echo ""

# Step 6: Check retry service logs
echo "Step 6: Checking DLQ retry service logs for both queues..."
echo ""
echo "   Mail DLQ processing:"
docker compose logs --tail 50 dlq_retry_service | grep -A 5 "mail_dlq" || echo "      No mail_dlq activity yet"
echo ""
echo "   Signal DLQ processing:"
docker compose logs --tail 50 dlq_retry_service | grep -A 5 "signal_dlq" || echo "      No signal_dlq activity yet"
echo ""

# Step 7: Monitor retry attempts
echo "Step 7: Monitoring retry attempts for both DLQs (10 seconds)..."
sleep 10
echo ""

echo "   Recent retry activity:"
docker compose logs --tail 100 dlq_retry_service | \
    grep -E "Processing DLQ|Original topic: (mails|signals)|Retry attempt|SUCCESS" | \
    tail -20 || echo "   No retry activity logged"
echo ""

# Step 8: Summary
echo "========================================="
echo "  Test Summary"
echo "========================================="
echo ""
echo "DLQ Message Counts:"
echo "   mail_dlq:   $MAIL_DLQ_INITIAL → $MAIL_DLQ_AFTER"
echo "   signal_dlq: $SIGNAL_DLQ_INITIAL → $SIGNAL_DLQ_AFTER"
echo ""
echo "The DLQ retry service monitors both queues and will:"
echo "   1. Retry failed mail messages → send back to 'mails' topic"
echo "   2. Retry failed signal messages → send back to 'signals' topic"
echo "   3. Apply same retry schedule to all DLQs (0s, 30s, 2min)"
echo ""
echo "To monitor live:"
echo "   docker compose logs -f dlq_retry_service"
echo ""
echo "To check specific DLQ:"
echo "   docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \\"
echo "       --bootstrap-server localhost:9092 \\"
echo "       --topic mail_dlq \\"  # or signal_dlq
echo "       --from-beginning \\"
echo "       --property print.headers=true"
echo ""
echo "=== Test Complete ==="
