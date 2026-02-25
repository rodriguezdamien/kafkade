# OLAP Analytics with Apache Druid and Superset

This document describes the OLAP (Online Analytical Processing) cube implementation for analyzing ticket metrics using Apache Druid and Apache Superset.

## Architecture

```
Kafka (tickets_labelized topic)
    ↓
Apache Druid (Real-time ingestion & OLAP storage)
    ↓
Apache Superset (Visualization & Dashboards)
```

## Components

### Apache Druid
- **Coordinator** (port 8081): Manages data availability and segment distribution
- **Broker** (port 8082): Handles queries from clients
- **Historical** (port 8083): Stores and serves historical data segments
- **MiddleManager** (port 8091): Handles data ingestion tasks
- **Router** (port 8888): Routes requests to appropriate services (main UI)

### Apache Superset
- **Port 8088**: Web UI for creating dashboards and visualizations
- **Default credentials**: admin/admin

### PostgreSQL
- Metadata storage for Druid
- Stores datasource configurations, segment information, etc.

### ZooKeeper
- Coordination service for Druid cluster

## Getting Started

### 1. Start the Analytics Stack

```bash
# Start all services including Druid and Superset
docker compose up -d

# Wait for services to be healthy (may take 2-3 minutes)
bash scripts/analytics/check-status.sh
```

### 2. Start Data Ingestion

Once Druid is ready, submit the ingestion specification:

```bash
bash scripts/analytics/start-ingestion.sh
```

This creates a Kafka supervisor that:
- Continuously reads from `tickets_labelized` topic
- Ingests data into Druid's `tickets` datasource
- Builds OLAP cubes for analysis

### 3. Verify Data Ingestion

Check that data is being ingested:

```bash
# Check overall status
bash scripts/analytics/check-status.sh

# Query for summary statistics
bash scripts/analytics/query-tickets.sh summary

# Query by ticket type
bash scripts/analytics/query-tickets.sh by-type

# Query by priority
bash scripts/analytics/query-tickets.sh by-priority

# Query by label
bash scripts/analytics/query-tickets.sh by-label

# Query time series data
bash scripts/analytics/query-tickets.sh time-series
```

## Available Metrics

The OLAP cube provides the following dimensions and metrics:

### Dimensions
- **id**: Unique ticket identifier
- **sender**: Ticket submitter
- **message**: Ticket content
- **type**: Ticket type (bug, feature, question)
- **priority**: Priority level (0-3, where 0 is highest)
- **labels**: Array of labels (Mobile, Web, Back-end, Infra)
- **__time**: Timestamp dimension for time-based analysis

### Metrics
- **count**: Total number of tickets
- **total_priority**: Sum of all priority values
- **min_priority**: Minimum priority value
- **max_priority**: Maximum priority value
- **unique_tickets**: Count of unique ticket IDs (using HyperLogLog)
- **unique_senders**: Count of unique senders (using HyperLogLog)

## Using Apache Druid Console

Access the Druid console at: http://localhost:8888

### Query Editor
1. Navigate to: http://localhost:8888/unified-console.html#query
2. Write SQL queries against the `tickets` datasource

Example queries:

```sql
-- Total tickets by type
SELECT type, COUNT(*) as count
FROM tickets
WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
GROUP BY type
ORDER BY count DESC

-- Average priority by label
SELECT labels, AVG(priority) as avg_priority, COUNT(*) as count
FROM tickets
WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
GROUP BY labels
ORDER BY count DESC

-- Tickets over time (hourly buckets)
SELECT 
  TIME_FLOOR(__time, 'PT1H') as hour,
  type,
  COUNT(*) as count,
  AVG(priority) as avg_priority
FROM tickets
WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
GROUP BY TIME_FLOOR(__time, 'PT1H'), type
ORDER BY hour DESC

-- Top senders
SELECT sender, COUNT(*) as ticket_count
FROM tickets
WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
GROUP BY sender
ORDER BY ticket_count DESC
LIMIT 10

-- Priority distribution by type
SELECT 
  type,
  priority,
  COUNT(*) as count
FROM tickets
WHERE __time >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
GROUP BY type, priority
ORDER BY type, priority
```

### Monitoring Ingestion
1. Navigate to: http://localhost:8888/unified-console.html#supervisors
2. Check the `tickets` supervisor status
3. Monitor lag, processed messages, and errors

### Data Management
1. Navigate to: http://localhost:8888/unified-console.html#datasources
2. View the `tickets` datasource
3. Check segment details, size, and retention

## Using Apache Superset

Access Superset at: http://localhost:8088

**Default credentials**: admin/admin

### Initial Setup

1. **Add Druid Database Connection**
   - Go to: Data → Databases
   - Click "+ Database"
   - Choose "Apache Druid"
   - SQLAlchemy URI: `druid://druid-broker:8082/druid/v2/sql`
   - Test connection and save

2. **Add the Tickets Dataset**
   - Go to: Data → Datasets
   - Click "+ Dataset"
   - Database: Select the Druid connection
   - Schema: druid
   - Table: tickets
   - Save

3. **Create Charts**

   Example charts to create:

   a. **Ticket Count by Type (Pie Chart)**
   - Metrics: COUNT(*)
   - Group by: type
   
   b. **Tickets Over Time (Line Chart)**
   - Metrics: COUNT(*)
   - Time column: __time
   - Time grain: Hour
   - Group by: type
   
   c. **Average Priority by Label (Bar Chart)**
   - Metrics: AVG(priority)
   - Group by: labels
   
   d. **Priority Distribution (Heatmap)**
   - Metrics: COUNT(*)
   - X-Axis: type
   - Y-Axis: priority

4. **Create a Dashboard**
   - Go to: Dashboards → "+ Dashboard"
   - Add your charts
   - Arrange and save

### Pre-built Dashboard (Optional)

You can manually create a dashboard with these visualizations:

1. **KPIs (Big Number)**
   - Total Tickets (last 24h)
   - Average Priority
   - Unique Senders
   - Most Common Type

2. **Time Series**
   - Tickets over time by type
   - Tickets over time by priority

3. **Distribution**
   - Tickets by type (pie chart)
   - Tickets by label (bar chart)
   - Priority distribution (histogram)

4. **Analysis**
   - Type vs Priority heatmap
   - Label combinations (table)
   - Top senders (table)

## Management Commands

### Check System Status
```bash
bash scripts/analytics/check-status.sh
```

### Start Ingestion
```bash
bash scripts/analytics/start-ingestion.sh
```

### Stop Ingestion
```bash
bash scripts/analytics/terminate-ingestion.sh
```

### Query Data
```bash
# Summary
bash scripts/analytics/query-tickets.sh summary

# By type
bash scripts/analytics/query-tickets.sh by-type

# By priority
bash scripts/analytics/query-tickets.sh by-priority

# By label
bash scripts/analytics/query-tickets.sh by-label

# Time series
bash scripts/analytics/query-tickets.sh time-series
```

## API Access

### Druid SQL API
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"query": "SELECT COUNT(*) FROM tickets"}' \
  http://localhost:8888/druid/v2/sql
```

### Druid Native Query API
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "queryType": "timeseries",
    "dataSource": "tickets",
    "granularity": "hour",
    "aggregations": [
      {"type": "count", "name": "count"}
    ],
    "intervals": ["2026-02-24/2026-02-26"]
  }' \
  http://localhost:8888/druid/v2
```

## Troubleshooting

### Druid Not Starting
- Check logs: `docker compose logs druid-coordinator`
- Ensure PostgreSQL is healthy: `docker compose ps postgres`
- Ensure ZooKeeper is running: `docker compose ps zookeeper`

### No Data in Druid
- Check supervisor status: `curl http://localhost:8888/druid/indexer/v1/supervisor/tickets/status`
- Verify Kafka topic has messages: `bash scripts/tests/consumer-labelized.sh 5`
- Check ingestion logs: `docker compose logs druid-middlemanager`

### Superset Connection Issues
- Verify Druid broker is healthy: `curl http://localhost:8888/status/health`
- Check connection string: `druid://druid-broker:8082/druid/v2/sql`
- Ensure Druid router is accessible from Superset container

### High Memory Usage
Druid is memory-intensive. If you experience issues:
- Reduce processing threads in docker-compose.yaml
- Reduce buffer sizes
- Limit the number of segments retained

## Performance Tuning

### For Better Query Performance
- Increase `druid_processing_numThreads`
- Increase `druid_processing_buffer_sizeBytes`
- Add more historical nodes

### For Better Ingestion Performance
- Increase task count in ingestion spec
- Adjust `taskDuration` for segment optimization
- Increase MiddleManager resources

### For Lower Resource Usage
- Decrease buffer sizes
- Reduce number of threads
- Adjust segment granularity (use DAY instead of HOUR)

## Data Retention

By default, Druid keeps all data. To configure retention:

1. Edit the ingestion spec retention rules
2. Use the Coordinator console to set drop rules
3. Configure automated compaction

Example retention policy (via API):
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '[
    {
      "type": "loadForever"
    }
  ]' \
  http://localhost:8888/druid/coordinator/v1/rules/tickets
```

## Resources

- Druid Documentation: https://druid.apache.org/docs/latest/
- Superset Documentation: https://superset.apache.org/docs/intro
- Druid SQL: https://druid.apache.org/docs/latest/querying/sql.html
- Kafka Ingestion: https://druid.apache.org/docs/latest/development/extensions-core/kafka-ingestion.html
