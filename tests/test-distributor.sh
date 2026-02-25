#!/bin/bash
# Test script for tickets_distributor service

set -e

echo "=== Testing Tickets Distributor ==="
echo ""

# Step 1: List all topics to see ticket-specific topics
echo "Step 1: Listing all Kafka topics..."
echo "----------------------------------------"
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 \
    --list | grep -E "^ticket-" || echo "No ticket-specific topics found yet"
echo ""

# Step 2: Check tickets_labelized topic for source data
echo "Step 2: Checking tickets_labelized topic (source)..."
echo "----------------------------------------"
echo "Fetching last 5 messages from tickets_labelized:"
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic tickets_labelized \
    --from-beginning \
    --max-messages 5 \
    --timeout-ms 10000 2>/dev/null | jq -r '.id' | sort -u || echo "No messages in tickets_labelized yet"
echo ""

# Step 3: Get ticket IDs from tickets_labelized
echo "Step 3: Extracting ticket IDs from tickets_labelized..."
echo "----------------------------------------"
TICKET_IDS=$(docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic tickets_labelized \
    --from-beginning \
    --max-messages 10 \
    --timeout-ms 10000 2>/dev/null | jq -r '.id' | sort -u || echo "")

if [ -z "$TICKET_IDS" ]; then
    echo "⚠️  No tickets found in tickets_labelized topic"
    echo "   The distributor needs labelized tickets to work."
    echo "   Make sure the mail_simulator, mail_formatter, and ticket_labelizer are running."
    exit 0
fi

echo "Found ticket IDs:"
echo "$TICKET_IDS"
echo ""

# Step 4: Check individual ticket topics
echo "Step 4: Checking individual ticket topics..."
echo "----------------------------------------"
for TICKET_ID in $TICKET_IDS; do
    TOPIC_NAME="ticket-${TICKET_ID}"
    echo "Checking topic: $TOPIC_NAME"
    
    # Check if topic exists
    if docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
        --bootstrap-server localhost:9092 \
        --list | grep -q "^${TOPIC_NAME}$"; then
        echo "✓ Topic exists: $TOPIC_NAME"
        
        # Read message from this topic
        MESSAGE=$(docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
            --bootstrap-server localhost:9092 \
            --topic "$TOPIC_NAME" \
            --from-beginning \
            --max-messages 1 \
            --timeout-ms 5000 2>/dev/null || echo "")
        
        if [ -n "$MESSAGE" ]; then
            echo "✓ Message found in $TOPIC_NAME:"
            echo "$MESSAGE" | jq '.' 2>/dev/null || echo "$MESSAGE"
        else
            echo "⚠️  No messages in $TOPIC_NAME yet"
        fi
    else
        echo "✗ Topic does not exist: $TOPIC_NAME"
    fi
    echo ""
done

# Step 5: Summary
echo "========================================="
echo "Summary:"
echo "========================================="
TICKET_TOPICS=$(docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 \
    --list | grep -E "^ticket-" || echo "")

if [ -n "$TICKET_TOPICS" ]; then
    TOPIC_COUNT=$(echo "$TICKET_TOPICS" | wc -l)
    echo "✓ Distributor is working!"
    echo "  Found $TOPIC_COUNT ticket-specific topic(s):"
    echo "$TICKET_TOPICS" | sed 's/^/    - /'
else
    echo "⚠️  No ticket-specific topics found"
    echo "   Check if tickets_distributor container is running:"
    echo "   docker compose ps tickets_distributor"
fi
echo ""
