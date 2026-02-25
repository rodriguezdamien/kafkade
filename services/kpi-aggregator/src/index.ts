import { Kafka, Consumer, Producer } from 'kafkajs';

// ─── Configuration ────────────────────────────────────────────────────────────

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const INPUT_TOPIC = process.env.KAFKA_INPUT_TOPIC || 'tickets_labelized';
const OUTPUT_TOPIC = process.env.KAFKA_OUTPUT_TOPIC || 'tickets_kpi';
const PUBLISH_INTERVAL_MS = Number(process.env.PUBLISH_INTERVAL_MS) || 5000; // 5 secondes

// ─── Types ────────────────────────────────────────────────────────────────────

type Label = 'Mobile' | 'Web' | 'Back-end' | 'Infra';
type TicketType = 'bug' | 'feature' | 'question';
type TicketStatus = 'open' | 'closed';

interface LabelizedTicket {
  id: string;
  sender: string;
  message: string;
  labels: Label[];
  type: TicketType;
  date: string;
  files?: string[];
  priority: number;
  status?: TicketStatus; // Optional for backward compatibility
}

interface KPIData {
  totalTickets: number;
  byType: Record<TicketType, number>;
  byLabel: Record<Label, number>;
  byPriority: Record<number, number>;
  byStatus: Record<TicketStatus, number>;
  lastUpdate: string;
  timestamp: number;
}

// ─── KPI Calculator ───────────────────────────────────────────────────────────

function calculateKPIFromTickets(tickets: LabelizedTicket[]): KPIData {
  const kpi: KPIData = {
    totalTickets: 0,
    byType: { bug: 0, feature: 0, question: 0 },
    byLabel: { Mobile: 0, Web: 0, 'Back-end': 0, Infra: 0 },
    byPriority: { 0: 0, 1: 0, 2: 0, 3: 0 },
    byStatus: { open: 0, closed: 0 },
    lastUpdate: new Date().toISOString(),
    timestamp: Date.now(),
  };

  // Use a Set to track unique ticket IDs and avoid duplicates
  const uniqueTicketIds = new Set<string>();

  for (const ticket of tickets) {
    // Skip duplicates
    if (uniqueTicketIds.has(ticket.id)) {
      continue;
    }
    uniqueTicketIds.add(ticket.id);

    kpi.totalTickets++;
    
    // Count by type
    kpi.byType[ticket.type]++;
    
    // Count by labels (a ticket can have multiple labels)
    for (const label of ticket.labels) {
      kpi.byLabel[label]++;
    }
    
    // Count by priority
    kpi.byPriority[ticket.priority]++;
    
    // Count by status (default to 'open' if not specified)
    const status = ticket.status || 'open';
    kpi.byStatus[status]++;
  }

  return kpi;
}

// ─── Fetch All Tickets ────────────────────────────────────────────────────────

async function fetchAllTickets(kafka: Kafka, topic: string): Promise<LabelizedTicket[]> {
  const consumer: Consumer = kafka.consumer({ 
    groupId: `kpi-reader-${Date.now()}` // Unique group ID each time
  });
  
  const tickets: LabelizedTicket[] = [];
  let isRunning = true;

  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });

    const messagePromise = new Promise<void>((resolve) => {
      let lastMessageTime = Date.now();
      let consumerRunning = false;
      
      consumer.run({
        eachMessage: async ({ message }) => {
          consumerRunning = true;
          lastMessageTime = Date.now();
          
          try {
            const value = message.value?.toString();
            if (value) {
              const ticket: LabelizedTicket = JSON.parse(value);
              tickets.push(ticket);
            }
          } catch (error) {
            console.error('[error] Failed to parse ticket:', error);
          }
        },
      }).catch(err => {
        console.error('[error] Consumer run error:', err);
        resolve();
      });
      
      // Check if we should stop
      const checkInterval = setInterval(() => {
        const idleTime = 2000; // Wait 2s after last message (reduced from 3s)
        if (!isRunning || (consumerRunning && Date.now() - lastMessageTime > idleTime)) {
          clearInterval(checkInterval);
          isRunning = false;
          resolve();
        }
      }, 500);
      
      // Maximum timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        isRunning = false;
        resolve();
      }, 20000); // 20s max (reduced from 30s)
    });

    await messagePromise;
    await consumer.stop();
    await consumer.disconnect();
    
    console.log(`[kpi] Fetched ${tickets.length} tickets from ${topic}`);
    return tickets;
  } catch (error) {
    console.error('[error] Failed to fetch tickets:', error);
    try {
      await consumer.stop();
      await consumer.disconnect();
    } catch (e) {}
    return [];
  }
}

// ─── Main Service ─────────────────────────────────────────────────────────────

async function main() {
  console.log('[kpi-aggregator] Starting KPI Aggregator Service...');
  console.log(`[config] Kafka Broker: ${KAFKA_BROKER}`);
  console.log(`[config] Input Topic: ${INPUT_TOPIC}`);
  console.log(`[config] Output Topic: ${OUTPUT_TOPIC}`);
  console.log(`[config] Publish Interval: ${PUBLISH_INTERVAL_MS}ms`);

  // Initialize Kafka
  const kafka = new Kafka({
    clientId: 'kpi-aggregator',
    brokers: [KAFKA_BROKER],
    retry: {
      retries: 10,
      initialRetryTime: 300,
    },
  });

  const producer: Producer = kafka.producer();
  await producer.connect();
  console.log('[kafka] Producer connected to Kafka');

  let isShuttingDown = false;

  // Periodic KPI calculation and publishing
  const updateKPI = async () => {
    if (isShuttingDown) return;

    try {
      console.log('[kpi] Fetching all tickets from queue...');
      const tickets = await fetchAllTickets(kafka, INPUT_TOPIC);
      
      if (tickets.length === 0) {
        console.log('[kpi] No tickets found yet, skipping...');
        return;
      }

      console.log(`[kpi] Calculating KPI from ${tickets.length} tickets...`);
      const kpi = calculateKPIFromTickets(tickets);
      
      console.log('[kpi] Publishing KPI:', JSON.stringify(kpi, null, 2));

      await producer.send({
        topic: OUTPUT_TOPIC,
        messages: [
          {
            key: 'kpi',
            value: JSON.stringify(kpi),
            timestamp: Date.now().toString(),
          },
        ],
      });

      console.log('[kpi] ✓ KPI published successfully');
      console.log(`[kpi] Stats: ${kpi.totalTickets} total, ${kpi.byStatus.open} open, ${kpi.byStatus.closed} closed`);
    } catch (error) {
      console.error('[error] Failed to update KPI:', error);
    }
  };

  // Initial update
  console.log('[kpi] Running initial KPI calculation...');
  await updateKPI();

  // Schedule periodic updates
  const interval = setInterval(updateKPI, PUBLISH_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[shutdown] Shutting down gracefully...');
    isShuttingDown = true;
    clearInterval(interval);
    await producer.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('[fatal] Service crashed:', error);
  process.exit(1);
});
