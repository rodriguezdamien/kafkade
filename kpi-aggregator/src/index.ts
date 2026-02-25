import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';

// ─── Configuration ────────────────────────────────────────────────────────────

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const INPUT_TOPIC = process.env.KAFKA_INPUT_TOPIC || 'tickets_labelized';
const OUTPUT_TOPIC = process.env.KAFKA_OUTPUT_TOPIC || 'tickets_kpi';
const CONSUMER_GROUP = process.env.KAFKA_GROUP_ID || 'kpi-aggregator-group';
const PUBLISH_INTERVAL_MS = Number(process.env.PUBLISH_INTERVAL_MS) || 5000; // 5 secondes

// ─── Types ────────────────────────────────────────────────────────────────────

type Label = 'Mobile' | 'Web' | 'Back-end' | 'Infra';
type TicketType = 'bug' | 'feature' | 'question';
type TicketStatus = 'open' | 'closed';

interface LabeledTicket {
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

// ─── KPI Store ────────────────────────────────────────────────────────────────

class KPIStore {
  private totalTickets = 0;
  private byType: Record<TicketType, number> = {
    bug: 0,
    feature: 0,
    question: 0,
  };
  private byLabel: Record<Label, number> = {
    Mobile: 0,
    Web: 0,
    'Back-end': 0,
    Infra: 0,
  };
  private byPriority: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
  };
  private byStatus: Record<TicketStatus, number> = {
    open: 0,
    closed: 0,
  };
  private processedTicketIds = new Set<string>(); // Track processed ticket IDs

  addTicket(ticket: LabeledTicket): boolean {
    // Check if ticket already processed
    if (this.processedTicketIds.has(ticket.id)) {
      console.log(`[kpi] Ticket ${ticket.id} already processed, skipping`);
      return false;
    }
    
    // Mark as processed
    this.processedTicketIds.add(ticket.id);
    
    this.totalTickets++;
    
    // Count by type
    this.byType[ticket.type]++;
    
    // Count by labels (a ticket can have multiple labels)
    for (const label of ticket.labels) {
      this.byLabel[label]++;
    }
    
    // Count by priority
    this.byPriority[ticket.priority]++;
    
    // Count by status (default to 'open' if not specified)
    const status = ticket.status || 'open';
    this.byStatus[status]++;
    
    return true;
  }

  getKPI(): KPIData {
    return {
      totalTickets: this.totalTickets,
      byType: { ...this.byType },
      byLabel: { ...this.byLabel },
      byPriority: { ...this.byPriority },
      byStatus: { ...this.byStatus },
      lastUpdate: new Date().toISOString(),
      timestamp: Date.now(),
    };
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

  const consumer: Consumer = kafka.consumer({ groupId: CONSUMER_GROUP });
  const producer: Producer = kafka.producer();

  const kpiStore = new KPIStore();
  let hasData = false;

  // Connect to Kafka
  await consumer.connect();
  await producer.connect();
  console.log('[kafka] Connected to Kafka');

  // Subscribe to input topic - read from beginning to get all historical data
  await consumer.subscribe({ topic: INPUT_TOPIC, fromBeginning: true });
  console.log(`[kafka] Subscribed to topic: ${INPUT_TOPIC} (from beginning)`);

  // Process messages
  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      try {
        const value = message.value?.toString();
        if (!value) {
          console.warn('[warn] Empty message received');
          return;
        }

        const ticket: LabeledTicket = JSON.parse(value);
        console.log(`[kpi] Processing ticket ${ticket.id} - Type: ${ticket.type}, Labels: ${ticket.labels.join(', ')}, Priority: ${ticket.priority}`);
        
        const isNew = kpiStore.addTicket(ticket);
        if (isNew) {
          hasData = true;
          console.log(`[kpi] ✓ Ticket ${ticket.id} added to KPI (Total: ${kpiStore.getKPI().totalTickets})`);
        }

      } catch (error) {
        console.error('[error] Failed to process message:', error);
      }
    },
  });

  // Periodic KPI publishing
  setInterval(async () => {
    if (!hasData) {
      console.log('[kpi] No data to publish yet, skipping...');
      return;
    }

    try {
      const kpi = kpiStore.getKPI();
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
    } catch (error) {
      console.error('[error] Failed to publish KPI:', error);
    }
  }, PUBLISH_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[shutdown] Shutting down gracefully...');
    await consumer.disconnect();
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
