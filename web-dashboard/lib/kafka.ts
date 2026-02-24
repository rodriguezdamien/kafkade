import { Kafka } from 'kafkajs';

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';

export const kafka = new Kafka({
  clientId: 'web-dashboard',
  brokers: [KAFKA_BROKER],
  retry: {
    retries: 3,
    initialRetryTime: 100,
  },
});

export interface KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key: string | null;
  value: string;
  headers: Record<string, string>;
}

export async function fetchMessagesFromTopic(
  topic: string,
  limit: number = 50
): Promise<KafkaMessage[]> {
  const consumer = kafka.consumer({ 
    groupId: `dashboard-${topic}-${Date.now()}` 
  });
  
  const messages: KafkaMessage[] = [];

  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 5000); // 5 second timeout

      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (messages.length >= limit) {
            clearTimeout(timeout);
            resolve();
            return;
          }

          const headers: Record<string, string> = {};
          if (message.headers) {
            Object.entries(message.headers).forEach(([key, value]) => {
              headers[key] = value?.toString() || '';
            });
          }

          messages.push({
            topic,
            partition,
            offset: message.offset,
            timestamp: message.timestamp,
            key: message.key?.toString() || null,
            value: message.value?.toString() || '',
            headers,
          });

          if (messages.length >= limit) {
            clearTimeout(timeout);
            resolve();
          }
        },
      }).catch(reject);
    });

    await consumer.disconnect();
    return messages;
  } catch (error) {
    console.error(`Error fetching messages from ${topic}:`, error);
    await consumer.disconnect().catch(() => {});
    return [];
  }
}

export async function listTopics(): Promise<string[]> {
  console.log(`[Kafka] Attempting to connect to broker: ${KAFKA_BROKER}`);
  const admin = kafka.admin();
  try {
    console.log('[Kafka] Connecting to admin client...');
    await admin.connect();
    console.log('[Kafka] Admin connected, listing topics...');
    const topics = await admin.listTopics();
    console.log(`[Kafka] Found ${topics.length} topics:`, topics);
    await admin.disconnect();
    const filteredTopics = topics.filter(t => !t.startsWith('_'));
    console.log(`[Kafka] Returning ${filteredTopics.length} non-internal topics:`, filteredTopics);
    return filteredTopics;
  } catch (error) {
    console.error('[Kafka] Error listing topics:', error);
    console.error('[Kafka] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    await admin.disconnect().catch(() => {});
    return [];
  }
}
