#!/bin/bash
# Compare input and output messages to verify transformation

set -e

echo "=== Message Transformation Verification ==="

# Consume one message from input topic
echo "Reading from signals topic..."
INPUT_MSG=$(docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic signals \
    --max-messages 1 \
    --timeout-ms 5000 2>/dev/null | head -1)

echo "Input message:"
echo "$INPUT_MSG" | python3 -m json.tool

# Wait a moment for processing
sleep 2

# Consume one message from output topic
echo ""
echo "Reading from tickets_formatted topic..."
OUTPUT_MSG=$(docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic tickets_formatted \
    --max-messages 1 \
    --timeout-ms 5000 2>/dev/null | head -1)

echo "Output message:"
echo "$OUTPUT_MSG" | python3 -m json.tool

# Verify transformation
echo ""
echo "=== Verification ==="
if echo "$OUTPUT_MSG" | grep -q '"id"'; then
    echo "✓ Field 'id' present in output"
else
    echo "✗ Field 'id' missing in output"
fi

if ! echo "$OUTPUT_MSG" | grep -q '"signal_instance"'; then
    echo "✓ Field 'signal_instance' removed from output"
else
    echo "✗ Field 'signal_instance' still present in output"
fi

if ! echo "$OUTPUT_MSG" | grep -q '"emojis"'; then
    echo "✓ Field 'emojis' removed from output"
else
    echo "✗ Field 'emojis' still present in output"
fi

echo ""
echo "=== Transformation verification complete ==="
