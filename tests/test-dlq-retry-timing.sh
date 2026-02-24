#!/bin/bash
# Test script to verify DLQ retry timing and exponential backoff

set -e

echo "========================================"
echo "  DLQ Retry Timing Verification Test"
echo "========================================"
echo ""
echo "This test verifies the retry delay schedule:"
echo "   Retry 1: Immediate (0s)"
echo "   Retry 2: After 30 seconds"
echo "   Retry 3: After 2 minutes (120s)"
echo ""

# Helper to get timestamp
timestamp() {
    date +"%H:%M:%S"
}

# Step 1: Ensure service is running
echo "Step 1: Starting fresh dlq_retry_service..."
docker compose restart dlq_retry_service
sleep 3
echo "✓ Service restarted"
echo ""

# Step 2: Send an invalid message
echo "Step 2: Sending invalid message at $(timestamp)..."
START_TIME=$(date +%s)
echo '{"bad": "json", "will": "fail"}' | \
docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic mails 2>/dev/null
echo "✓ Message sent"
echo ""

# Step 3: Monitor logs for retry attempts
echo "Step 3: Monitoring retry attempts with timestamps..."
echo ""
echo "Waiting for retry activity (this will take ~3 minutes)..."
echo "Press Ctrl+C to stop monitoring early"
echo ""
echo "Timeline:"
echo "  $(timestamp) - Test started"
echo ""

# Monitor for 210 seconds (3.5 minutes) to capture all retries
timeout 210s docker compose logs -f dlq_retry_service 2>/dev/null | \
grep --line-buffered -E "Processing DLQ|Retry attempt|Waiting.*before retry|SUCCESS|PERMANENT FAILURE" | \
while IFS= read -r line; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    echo "  [+${ELAPSED}s] $(timestamp) - $line"
done || true

echo ""
echo "=== Timing Analysis ==="
echo "Expected timings (approximately):"
echo "   0-10s:    First retry attempt (immediate)"
echo "   30-40s:   Second retry attempt (after 30s delay)"
echo "   150-160s: Third retry attempt (after 2min delay from 2nd attempt)"
echo "   160s+:    Permanent failure notification"
echo ""
echo "Review the timestamps above to verify the delays match expectations."
echo ""
echo "=== Test Complete ==="
