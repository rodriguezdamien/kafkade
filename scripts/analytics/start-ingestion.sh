#!/bin/bash
# Script to submit the Druid ingestion specification for tickets

set -e

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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
    echo "   bash scripts/analytics/terminate-ingestion.sh"
    exit 0
fi

if echo "$EXISTING" | grep -q "formatted"; then
    echo "⚠️  Supervisor 'formatted' already exists"
    echo "   To update, first terminate the existing supervisor:"
    echo "   bash scripts/analytics/terminate-ingestion.sh"
    exit 0
fi


# Submit the ingestion spec
echo "Submitting ingestion specification..."
RESPONSE=$(curl -s -X POST \
    -H 'Content-Type: application/json' \
    -d @"$PROJECT_ROOT/druid/tickets-ingestion-spec.json" \
    http://localhost:8888/druid/indexer/v1/supervisor)

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Submit the ingestion spec
echo "Submitting ingestion specification..."
RESPONSE=$(curl -s -X POST \
    -H 'Content-Type: application/json' \
    -d @"$PROJECT_ROOT/druid/formatted-ingestion-spec.json" \
    http://localhost:8888/druid/indexer/v1/supervisor)

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check supervisor status
echo "Checking supervisor status..."
sleep 3
curl -s http://localhost:8888/druid/indexer/v1/supervisor/tickets/status | jq '.'
echo ""

echo "Checking supervisor status..."
sleep 3
curl -s http://localhost:8888/druid/indexer/v1/supervisor/formatted/status | jq '.'
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
