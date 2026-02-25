#!/bin/bash
# Script to query Druid for formatted ticket analytics

set -e

QUERY_TYPE=${1:-"summary"}

case $QUERY_TYPE in
    summary)
        echo "=== Formatted Tickets Summary ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT COUNT(*) as total_tickets, COUNT(DISTINCT sender) as unique_senders FROM tickets_formatted WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\''1'\'' DAY"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    by-sender)
        echo "=== Formatted Tickets by Sender ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT sender, COUNT(*) as ticket_count FROM tickets_formatted WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\''1'\'' DAY GROUP BY sender ORDER BY ticket_count DESC LIMIT 10"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    with-files)
        echo "=== Formatted Tickets with Attachments ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT COUNT(*) as tickets_with_files FROM tickets_formatted WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\''1'\'' DAY AND ARRAY_LENGTH(files) > 0"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    time-series)
        echo "=== Formatted Tickets Over Time (Hourly) ==="
        curl -s -X POST \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "SELECT TIME_FLOOR(__time, '\''PT1H'\'') as hour, COUNT(*) as ticket_count FROM tickets_formatted WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '\''1'\'' DAY GROUP BY TIME_FLOOR(__time, '\''PT1H'\'') ORDER BY hour DESC"
            }' \
            http://localhost:8888/druid/v2/sql | jq '.'
        ;;
        
    *)
        echo "Usage: $0 [summary|by-sender|with-files|time-series]"
        echo ""
        echo "Examples:"
        echo "  $0 summary      - Show overall formatted ticket statistics"
        echo "  $0 by-sender    - Show tickets grouped by sender"
        echo "  $0 with-files   - Show tickets with file attachments"
        echo "  $0 time-series  - Show tickets over time (hourly)"
        exit 1
        ;;
esac
