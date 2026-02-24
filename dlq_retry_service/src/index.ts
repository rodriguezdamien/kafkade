import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';

// Configuration from environment variables
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const MAX_RETRY_ATTEMPTS = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3');
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'dlq-retry-service-group';

const DLQ_TOPICS = [
  'mail_dlq',
  'signal_dlq',
];

// Retry delays: immediate (0s), 30s, 2 minutes (120s)
const RETRY_DELAYS = [0, 30000, 120000];

interface ErrorStats {
  count: number;
  lastError: string;
  firstOccurrence: Date;
}

const errorAggregation = new Map<string, ErrorStats>();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendDiscordNotification(message: string): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('Discord webhook URL not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });

    if (!response.ok) {
      console.error(`Failed to send Discord notification: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error sending Discord notification:', error);
  }
}

function aggregateError(errorKey: string, errorMessage: string): void {
  const existing = errorAggregation.get(errorKey);
  
  if (existing) {
    existing.count++;
    existing.lastError = errorMessage;
  } else {
    errorAggregation.set(errorKey, {
      count: 1,
      lastError: errorMessage,
      firstOccurrence: new Date()
    });
  }
}

setInterval(async () => {
  if (errorAggregation.size === 0) return;

  const summary = Array.from(errorAggregation.entries())
    .map(([key, stats]) => {
      const duration = Math.floor((Date.now() - stats.firstOccurrence.getTime()) / 60000);
      return `**${key}** (${stats.count}x in last ${duration}min)\n   └─ ${stats.lastError}`;
    })
    .join('\n\n');

  await sendDiscordNotification(
    `**DLQ Retry Service - Error Summary**\n\n${summary}\n\n*Check logs for details*`
  );

  errorAggregation.clear();
}, 10 * 60 * 1000);

class DLQRetryService {
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'dlq-retry-service',
      brokers: [KAFKA_BROKER],
      retry: {
        retries: 10,
        initialRetryTime: 300,
        multiplier: 2,
      },
    });

    this.consumer = this.kafka.consumer({ 
      groupId: GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    
    this.producer = this.kafka.producer();
  }

  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { message, topic } = payload;

    if (!message.value) {
      console.warn('Received empty message, skipping...');
      return;
    }

    const messageValue = message.value.toString();
    const headers = message.headers || {};
    
    // Extract metadata from headers
    const originalTopic = headers['original-topic']?.toString() || 'unknown';
    const originalOffset = headers['original-offset']?.toString() || 'unknown';
    const errorMessage = headers['error-message']?.toString() || 'Unknown error';
    
    // Check how many times this message has already been retried
    const currentRetryCount = parseInt(headers['retry-attempt']?.toString() || '0');

    console.log(`\nProcessing DLQ message from ${topic}`);
    console.log(`   Original topic: ${originalTopic}`);
    console.log(`   Original offset: ${originalOffset}`);
    console.log(`   Retry count: ${currentRetryCount}/${MAX_RETRY_ATTEMPTS}`);
    console.log(`   Previous error: ${errorMessage}`);

    // Check if we've exceeded max retries
    if (currentRetryCount >= MAX_RETRY_ATTEMPTS) {
      console.error(`   PERMANENT FAILURE after ${MAX_RETRY_ATTEMPTS} attempts`);
      console.error(`   Message: ${messageValue.substring(0, 100)}...`);
      
      // Send immediate Discord notification
      const alertMessage = 
        `🚨 **PERMANENT FAILURE - DLQ Retry Service**\n\n` +
        `**Topic:** ${originalTopic}\n` +
        `**DLQ:** ${topic}\n` +
        `**Offset:** ${originalOffset}\n` +
        `**Retries:** ${currentRetryCount}/${MAX_RETRY_ATTEMPTS}\n` +
        `**Error:** ${errorMessage}\n` +
        `**Message preview:** \`${messageValue.substring(0, 200).replace(/`/g, "'")}\`\n\n` +
        `*Check logs for full details*`;
      
      await sendDiscordNotification(alertMessage);
      
      const errorKey = `${originalTopic} (${topic})`;
      const errorDetail = errorMessage || 'Unknown error after retries';
      aggregateError(errorKey, errorDetail);
      
      return;
    }

    // Calculate delay before retry (indexed by retry attempt number)
    // Attempt 1: RETRY_DELAYS[0] = 0ms (immediate)
    // Attempt 2: RETRY_DELAYS[1] = 30000ms (30s)
    // Attempt 3: RETRY_DELAYS[2] = 120000ms (2min)
    const delay = RETRY_DELAYS[currentRetryCount] || 0;
    
    if (delay > 0) {
      console.log(`   Waiting ${delay / 1000}s before retry...`);
      await sleep(delay);
    }

    try {
      console.log(`   Retry attempt ${currentRetryCount + 1}/${MAX_RETRY_ATTEMPTS}...`);
      
      // Send back to original topic for reprocessing with incremented retry count
      await this.producer.send({
        topic: originalTopic,
        messages: [
          {
            key: message.key,
            value: message.value,
            headers: {
              'retry-from-dlq': 'true',
              'retry-attempt': (currentRetryCount + 1).toString(),
              'original-dlq-topic': topic
            }
          }
        ]
      });

      console.log(`   SUCCESS! Message sent back to ${originalTopic} for reprocessing`);
      
    } catch (error) {
      const err = error as Error;
      console.error(`   Failed to send message back to ${originalTopic}:`, err.message);
      
      // If we can't even send to Kafka, aggregate error
      const errorKey = `${originalTopic} (${topic})`;
      aggregateError(errorKey, `Kafka send error: ${err.message}`);
    }
  }

  async start(): Promise<void> {
    console.log('Starting DLQ Retry Service...');
    console.log(`Configuration:`);
    console.log(`   Kafka Broker: ${KAFKA_BROKER}`);
    console.log(`   Max Retry Attempts: ${MAX_RETRY_ATTEMPTS}`);
    console.log(`   Retry Delays: ${RETRY_DELAYS.map(d => d / 1000 + 's').join(', ')}`);
    console.log(`   Monitoring DLQs: ${DLQ_TOPICS.join(', ')}`);
    console.log(`   Discord Webhook: ${DISCORD_WEBHOOK_URL ? 'Configured' : 'Not configured'}`);
    console.log('');

    await this.consumer.connect();
    await this.producer.connect();
    console.log('Connected to Kafka\n');

    for (const dlqTopic of DLQ_TOPICS) {
      await this.consumer.subscribe({ 
        topic: dlqTopic, 
        fromBeginning: false
      });
      console.log(`Subscribed to ${dlqTopic}`);
    }

    console.log('\nDLQ Retry Service is running and monitoring DLQs...\n');

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.processMessage(payload);
      },
    });
  }

  async stop(): Promise<void> {
    console.log('\nShutting down DLQ Retry Service...');
    await this.consumer.disconnect();
    await this.producer.disconnect();
    console.log('Disconnected from Kafka');
  }
}

const service = new DLQRetryService();

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM');
  await service.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT');
  await service.stop();
  process.exit(0);
});

service.start().catch((error) => {
  console.error('Failed to start DLQ Retry Service:', error);
  process.exit(1);
});
