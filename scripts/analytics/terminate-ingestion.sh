#!/bin/bash
# Script to terminate the Druid ingestion supervisor

set -e

echo "=== Terminating Druid Supervisor ==="
echo ""

# Check if supervisor exists
echo "Checking supervisor status..."
STATUS=$(curl -s http://localhost:8888/druid/indexer/v1/supervisor/tickets/status 2>/dev/null || echo "")

if [ -z "$STATUS" ] || echo "$STATUS" | grep -q "Unknown supervisor"; then
    echo "⚠️  No supervisor 'tickets' found"
    exit 0
fi

# Terminate the supervisor
echo "Terminating supervisor 'tickets'..."
RESPONSE=$(curl -s -X POST http://localhost:8888/druid/indexer/v1/supervisor/tickets/terminate)

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

echo "✓ Supervisor terminated"
echo ""
echo "To restart ingestion, run:"
echo "  bash scripts/analytics/start-ingestion.sh"

# Check if supervisor exists
echo "Checking supervisor status..."
STATUS=$(curl -s http://localhost:8888/druid/indexer/v1/supervisor/formatted/status 2>/dev/null || echo "")

if [ -z "$STATUS" ] || echo "$STATUS" | grep -q "Unknown supervisor"; then
    echo "⚠️  No supervisor 'formatted' found"
    exit 0
fi

# Terminate the supervisor
echo "Terminating supervisor 'formatted'..."
RESPONSE=$(curl -s -X POST http://localhost:8888/druid/indexer/v1/supervisor/formatted/terminate)

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

echo "✓ Supervisor terminated"
echo ""
echo "To restart ingestion, run:"
echo "  bash scripts/analytics/start-ingestion.sh"
