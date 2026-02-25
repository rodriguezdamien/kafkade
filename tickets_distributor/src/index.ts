import { Kafka, Consumer, Producer, Admin, EachMessagePayload } from 'kafkajs';

// Configuration from environment variables
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const KAFKA_INPUT_TOPIC = process.env.KAFKA_INPUT_TOPIC || 'tickets_labelized';
const KAFKA_OUTPUT_TOPIC_PREFIX = process.env.KAFKA_OUTPUT_TOPIC_PREFIX || 'ticket';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'tickets-distributor-group';

// LabeledTicket format (from ticket-labeller)
interface LabeledTicket {
  id: string;
  sender: string;
  message: string;
  labels: string[];
  type: string;
  date: string;
  priority: number;
  files: string[];
}

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'tickets-distributor',
  brokers: [KAFKA_BROKER]
});

// Create consumer, producer, and admin
const consumer: Consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });
const producer: Producer = kafka.producer();
const admin: Admin = kafka.admin();

// Track created topics to avoid redundant checks
const createdTopics = new Set<string>();

// Ensure topic exists
async function ensureTopicExists(topicName: string): Promise<void> {
  // If we already created this topic in this session, skip
  if (createdTopics.has(topicName)) {
    return;
  }

  try {
    // Check if topic exists
    const existingTopics = await admin.listTopics();
    
    if (existingTopics.includes(topicName)) {
      console.log(`Topic ${topicName} already exists`);
      createdTopics.add(topicName);
      return;
    }

    // Create the topic
    await admin.createTopics({
      topics: [
        {
          topic: topicName,
          numPartitions: 1,
          replicationFactor: 1
        }
      ]
    });
    
    console.log(`Created topic: ${topicName}`);
    createdTopics.add(topicName);
  } catch (error) {
    // If topic was created between check and create, ignore the error
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(`Topic ${topicName} already exists (created concurrently)`);
      createdTopics.add(topicName);
    } else {
      throw error;
    }
  }
}

// Process each message
async function processMessage(payload: EachMessagePayload): Promise<void> {
  const { message } = payload;
  
  if (!message.value) {
    console.warn('Received message with no value, skipping...');
    return;
  }

  try {
    // Parse incoming labeled ticket
    const ticket: LabeledTicket = JSON.parse(message.value.toString());
    console.log(`Processing ticket ${ticket.id} from ${ticket.sender}`);

    // Generate topic name for this specific ticket
    const ticketTopicName = `${KAFKA_OUTPUT_TOPIC_PREFIX}-${ticket.id}`;

    // Ensure the topic exists
    await ensureTopicExists(ticketTopicName);

    // Send ticket to its specific topic
    await producer.send({
      topic: ticketTopicName,
      messages: [
        {
          key: ticket.id,
          value: JSON.stringify(ticket)
        }
      ]
    });

    console.log(`Distributed ticket ${ticket.id} to topic ${ticketTopicName}`);
  } catch (error) {
    console.error('Error processing message:', error);
    if (message.value) {
      console.error('Message content:', message.value.toString());
    }
  }
}

// Main function
async function main() {
  console.log('Starting Tickets Distributor...');
  console.log(`Kafka Broker: ${KAFKA_BROKER}`);
  console.log(`Input Topic: ${KAFKA_INPUT_TOPIC}`);
  console.log(`Output Topic Prefix: ${KAFKA_OUTPUT_TOPIC_PREFIX}`);
  console.log(`Consumer Group: ${KAFKA_GROUP_ID}\n`);

  try {
    // Connect admin client
    await admin.connect();
    console.log('Admin client connected');

    // Connect producer
    await producer.connect();
    console.log('Producer connected');

    // Connect consumer
    await consumer.connect();
    console.log('Consumer connected');

    // Subscribe to input topic
    await consumer.subscribe({ 
      topic: KAFKA_INPUT_TOPIC, 
      fromBeginning: true 
    });
    console.log(`Subscribed to topic: ${KAFKA_INPUT_TOPIC}\n`);

    // Start consuming messages
    await consumer.run({
      eachMessage: processMessage
    });

    console.log('Tickets distributor is running and waiting for messages...\n');

  } catch (error) {
    console.error('Fatal error:', error);
    await shutdown();
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down...');
  try {
    await consumer.disconnect();
    console.log('Consumer disconnected');
    await producer.disconnect();
    console.log('Producer disconnected');
    await admin.disconnect();
    console.log('Admin client disconnected');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
}

// Handle shutdown signals
process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

// Run the distributor
main().catch(console.error);
