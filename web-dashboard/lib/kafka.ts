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
  limit: number = 50,
  fromEnd: boolean = false
): Promise<KafkaMessage[]> {
  const consumer = kafka.consumer({ 
    groupId: `dashboard-${topic}-${Date.now()}` 
  });
  
  const messages: KafkaMessage[] = [];
  let isRunning = true;
  let consumerRunning = false;

  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: !fromEnd });

    const messagePromise = new Promise<void>((resolve) => {
      let lastMessageTime = Date.now();
      let checkInterval: NodeJS.Timeout;
      
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          consumerRunning = true;
          lastMessageTime = Date.now();
          
          if (messages.length >= limit) {
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
        },
      });
      
      // Check if we should stop
      checkInterval = setInterval(() => {
        const idleTime = fromEnd ? 3000 : 5000; // Give more time for beginning reads
        if (!isRunning || messages.length >= limit || (consumerRunning && Date.now() - lastMessageTime > idleTime)) {
          clearInterval(checkInterval);
          isRunning = false;
          resolve();
        }
      }, 500);
      
      // Maximum timeout - increased to let consumer join group
      setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
        isRunning = false;
        resolve();
      }, 35000); // Increased to 35s to allow group join + consumption
    });

    await messagePromise;
    
    // Properly stop the consumer before disconnecting
    await consumer.stop();
    await consumer.disconnect();
    return messages;
  } catch (error) {
    console.error(`Error fetching messages from ${topic}:`, error);
    try {
      await consumer.stop();
    } catch (e) {}
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
