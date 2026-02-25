# Quick Start - OLAP Analytics

This guide gets you started with OLAP analytics in under 5 minutes.

## Step 1: Start All Services

```bash
# Start the entire stack (including Druid and Superset)
docker compose up -d

# This will start:
# - Kafka
# - All ticket processing services
# - PostgreSQL (Druid metadata)
# - ZooKeeper (Druid coordination)
# - Druid cluster (5 services)
# - Superset
```

## Step 2: Wait for Services (2-3 minutes)

```bash
# Check status
bash scripts/analytics/check-status.sh
```

Wait until you see all services healthy.

## Step 3: Start Data Ingestion

```bash
# Submit the ingestion specification to Druid
bash scripts/analytics/start-ingestion.sh
```

This creates a Kafka supervisor that continuously ingests tickets from `tickets_labelized` topic.

## Step 4: Verify Data

```bash
# Get summary statistics
bash scripts/analytics/query-tickets.sh summary

# See tickets by type
bash scripts/analytics/query-tickets.sh by-type

# See tickets by priority
bash scripts/analytics/query-tickets.sh by-priority
```

## Step 5: Access UIs

### Druid Console
- URL: http://localhost:8888
- Query editor: http://localhost:8888/unified-console.html#query
- Supervisors: http://localhost:8888/unified-console.html#supervisors

### Superset Dashboard
- URL: http://localhost:8088
- Username: admin
- Password: admin

## Example Druid SQL Queries

Access the Druid console and try these queries:

```sql
-- Total tickets in last 24 hours
SELECT COUNT(*) as total_tickets
FROM tickets
WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR

-- Tickets by type and priority
SELECT type, priority, COUNT(*) as count
FROM tickets
WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
GROUP BY type, priority
ORDER BY count DESC

-- Hourly ticket volume
SELECT 
  TIME_FLOOR(__time, 'PT1H') as hour,
  COUNT(*) as count
FROM tickets
WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
GROUP BY TIME_FLOOR(__time, 'PT1H')
ORDER BY hour DESC
```

## Creating Superset Dashboard

1. **Add Database Connection**
   - Go to: Data → Databases → + Database
   - Choose "Apache Druid"
   - URI: `druid://druid-broker:8082/druid/v2/sql`
   - Test & Save

2. **Add Dataset**
   - Go to: Data → Datasets → + Dataset
   - Select Druid database
   - Schema: druid
   - Table: tickets

3. **Create Charts**
   - Go to: Charts → + Chart
   - Choose dataset: tickets
   - Select visualization type
   - Configure metrics and dimensions

4. **Build Dashboard**
   - Go to: Dashboards → + Dashboard
   - Add charts
   - Save

## Useful Commands

```bash
# Check status of all services
bash scripts/analytics/check-status.sh

# Query tickets (various dimensions)
bash scripts/analytics/query-tickets.sh [summary|by-type|by-priority|by-label|time-series]

# Stop ingestion (when needed)
bash scripts/analytics/terminate-ingestion.sh

# Restart ingestion
bash scripts/analytics/start-ingestion.sh

# Check what's in Kafka
bash scripts/tests/consumer-labelized.sh 5
```

## Metrics Available

### Dimensions
- **type**: bug, feature, question
- **priority**: 0 (highest) to 3 (lowest)
- **labels**: Mobile, Web, Back-end, Infra
- **sender**: Email of ticket creator
- **__time**: Timestamp

### Aggregations
- Count of tickets
- Average/Min/Max priority
- Unique senders
- Unique tickets

## Need More Details?

See [OLAP-ANALYTICS.md](OLAP-ANALYTICS.md) for comprehensive documentation.
