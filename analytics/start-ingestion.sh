#!/bin/bash
# Script to submit the Druid ingestion specification for tickets

set -e

echo "=== Submitting Druid Ingestion Spec ==="
echo ""

# Wait for Druid to be ready
echo "Waiting for Druid router to be ready..."
until curl -s http://localhost:8888/status/health > /dev/null 2>&1; do
    echo "  Waiting for Druid router..."
    sleep 5
done
echo "✓ Druid router is ready"
echo ""

# Check if supervisor already exists
echo "Checking if tickets supervisor exists..."
EXISTING=$(curl -s http://localhost:8888/druid/indexer/v1/supervisor)

if echo "$EXISTING" | grep -q "tickets"; then
    echo "⚠️  Supervisor 'tickets' already exists"
    echo "   To update, first terminate the existing supervisor:"
    echo "   bash analytics/terminate-ingestion.sh"
    exit 0
fi

# Submit the ingestion spec
echo "Submitting ingestion specification..."
RESPONSE=$(curl -s -X POST \
    -H 'Content-Type: application/json' \
    -d @druid/tickets-ingestion-spec.json \
    http://localhost:8888/druid/indexer/v1/supervisor)

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check supervisor status
echo "Checking supervisor status..."
sleep 3
curl -s http://localhost:8888/druid/indexer/v1/supervisor/tickets/status | jq '.'
echo ""

echo "========================================="
echo "✓ Ingestion specification submitted!"
echo ""
echo "Monitor the supervisor at:"
echo "  http://localhost:8888/unified-console.html#supervisors"
echo ""
echo "Check datasource status at:"
echo "  http://localhost:8888/unified-console.html#datasources"
echo ""
echo "Query the data at:"
echo "  http://localhost:8888/unified-console.html#query"
echo "========================================="
