#!/bin/bash
# Script to query Druid for ticket analytics

set -e

QUERY_TYPE=${1:-"summary"}

case $QUERY_TYPE in
    summary)
        echo "=== Ticket Summary ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT COUNT(*) as total_tickets, COUNT(DISTINCT sender) as unique_senders FROM tickets WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\''1'\'' DAY"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    by-type)
        echo "=== Tickets by Type ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT type, COUNT(*) as ticket_count, AVG(priority) as avg_priority FROM tickets WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\''1'\'' DAY GROUP BY type ORDER BY ticket_count DESC"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    by-priority)
        echo "=== Tickets by Priority ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT priority, COUNT(*) as ticket_count, type FROM tickets WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\''1'\'' DAY GROUP BY priority, type ORDER BY priority, ticket_count DESC"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    by-label)
        echo "=== Tickets by Label ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT labels, COUNT(*) as ticket_count FROM tickets WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\''1'\'' DAY GROUP BY labels ORDER BY ticket_count DESC"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    time-series)
        echo "=== Tickets Over Time (Hourly) ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT TIME_FLOOR(__time, '\'PT1H\'') as hour, type, COUNT(*) as ticket_count FROM tickets WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\'1\'' DAY GROUP BY TIME_FLOOR(__time, '\'PT1H\''), type ORDER BY hour DESC, ticket_count DESC"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    *)
        echo "Usage: $0 [summary|by-type|by-priority|by-label|time-series]"
        echo ""
        echo "Examples:"
        echo "  $0 summary       - Show overall ticket statistics"
        echo "  $0 by-type       - Show tickets grouped by type"
        echo "  $0 by-priority   - Show tickets grouped by priority"
        echo "  $0 by-label      - Show tickets grouped by label"
        echo "  $0 time-series   - Show tickets over time (hourly)"
        exit 1
        ;;
esac
