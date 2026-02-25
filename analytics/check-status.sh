#!/bin/bash
# Script to check the status of Druid services and data ingestion

set -e

echo "=== Druid & Analytics Status ==="
echo ""

# Check Druid services
echo "1. Checking Druid Services..."
echo "----------------------------------------"

services=("coordinator:8081" "broker:8082" "historical:8083" "middlemanager:8091" "router:8888")

for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    if curl -s http://localhost:$port/status/health > /dev/null 2>&1; then
        echo "  ✓ $name (port $port) - healthy"
    else
        echo "  ✗ $name (port $port) - not responding"
    fi
done
echo ""

# Check supervisor status
echo "2. Checking Ingestion Supervisors..."
echo "----------------------------------------"

echo "  Tickets (Labelized):"
SUPERVISOR_STATUS=$(curl -s http://localhost:8888/druid/indexer/v1/supervisor/tickets/status 2>/dev/null || echo "{}")

if echo "$SUPERVISOR_STATUS" | grep -q "RUNNING"; then
    STATE=$(echo "$SUPERVISOR_STATUS" | jq -r '.payload.state' 2>/dev/null || echo "UNKNOWN")
    echo "    ✓ Supervisor state: $STATE"
    
    # Get lag info
    LAG=$(echo "$SUPERVISOR_STATUS" | jq -r '.payload.stats.totals.lag' 2>/dev/null || echo "N/A")
    PROCESSED=$(echo "$SUPERVISOR_STATUS" | jq -r '.payload.stats.totals.processed' 2>/dev/null || echo "N/A")
    
    echo "    • Processed messages: $PROCESSED"
    echo "    • Current lag: $LAG"
elif echo "$SUPERVISOR_STATUS" | grep -q "Unknown supervisor"; then
    echo "    ⚠️  No supervisor configured"
    echo "       Run: bash analytics/start-ingestion.sh"
else
    echo "    ⚠️  Supervisor not running"
fi

echo "  Tickets (Formatted):"
SUPERVISOR_FORMATTED=$(curl -s http://localhost:8888/druid/indexer/v1/supervisor/tickets_formatted/status 2>/dev/null || echo "{}")

if echo "$SUPERVISOR_FORMATTED" | grep -q "RUNNING"; then
    STATE=$(echo "$SUPERVISOR_FORMATTED" | jq -r '.payload.state' 2>/dev/null || echo "UNKNOWN")
    echo "    ✓ Supervisor state: $STATE"
    
    # Get lag info
    LAG=$(echo "$SUPERVISOR_FORMATTED" | jq -r '.payload.stats.totals.lag' 2>/dev/null || echo "N/A")
    PROCESSED=$(echo "$SUPERVISOR_FORMATTED" | jq -r '.payload.stats.totals.processed' 2>/dev/null || echo "N/A")
    
    echo "    • Processed messages: $PROCESSED"
    echo "    • Current lag: $LAG"
elif echo "$SUPERVISOR_FORMATTED" | grep -q "Unknown supervisor"; then
    echo "    ⚠️  No supervisor configured"
    echo "       Run: bash analytics/start-ingestion-formatted.sh"
else
    echo "    ⚠️  Supervisor not running"
fi
echo ""

# Check datasources
echo "3. Checking Datasources..."
echo "----------------------------------------"

DATASOURCES=$(curl -s http://localhost:8888/druid/coordinator/v1/datasources 2>/dev/null || echo "[]")

if echo "$DATASOURCES" | grep -q "\"tickets\""; then
    echo "  ✓ Datasource 'tickets' exists"
    
    # Get segment info
    SEGMENTS=$(curl -s http://localhost:8888/druid/coordinator/v1/datasources/tickets?full 2>/dev/null)
    SEGMENT_COUNT=$(echo "$SEGMENTS" | jq -r '.segments | length' 2>/dev/null || echo "0")
    SIZE=$(echo "$SEGMENTS" | jq -r '.properties.segments.size' 2>/dev/null || echo "N/A")
    
    echo "    • Segments: $SEGMENT_COUNT"
    echo "    • Size: $SIZE bytes"
else
    echo "  ⚠️  Datasource 'tickets' not found"
fi

if echo "$DATASOURCES" | grep -q "tickets_formatted"; then
    echo "  ✓ Datasource 'tickets_formatted' exists"
    
    # Get segment info
    SEGMENTS=$(curl -s http://localhost:8888/druid/coordinator/v1/datasources/tickets_formatted?full 2>/dev/null)
    SEGMENT_COUNT=$(echo "$SEGMENTS" | jq -r '.segments | length' 2>/dev/null || echo "0")
    SIZE=$(echo "$SEGMENTS" | jq -r '.properties.segments.size' 2>/dev/null || echo "N/A")
    
    echo "    • Segments: $SEGMENT_COUNT"
    echo "    • Size: $SIZE bytes"
else
    echo "  ⚠️  Datasource 'tickets_formatted' not found"
fi
echo ""

# Check Superset
echo "4. Checking Superset..."
echo "----------------------------------------"

if curl -s http://localhost:8088/health > /dev/null 2>&1; then
    echo "  ✓ Superset is running (port 8088)"
else
    echo "  ✗ Superset is not responding"
fi
echo ""

# Summary
echo "========================================="
echo "Access Points:"
echo "========================================="
echo "Druid Console:   http://localhost:8888"
echo "Superset:        http://localhost:8088"
echo "                 (admin/admin)"
echo ""
echo "Useful commands:"
echo "  Start ingestion:   bash analytics/start-ingestion.sh"
echo "  Query data:        bash analytics/query-tickets.sh summary"
echo "  Stop ingestion:    bash analytics/terminate-ingestion.sh"
echo ""
