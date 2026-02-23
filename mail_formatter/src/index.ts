import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';

// Configuration from environment variables
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const KAFKA_INPUT_TOPIC = process.env.KAFKA_INPUT_TOPIC || 'mails';
const KAFKA_OUTPUT_TOPIC = process.env.KAFKA_OUTPUT_TOPIC || 'tickets_formatted';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'mail-formatter-group';

// Input format (EmailMessage from mail_simulator)
interface EmailMessage {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  attachments: string[];
}

// Output format (Ticket)
interface Ticket {
  id: string;
  sender: string;
  message: string;
  date: string;
  files: string[];
}

// Transform EmailMessage to Ticket format
function formatEmailToTicket(email: EmailMessage): Ticket {
  return {
    id: email.messageId,
    sender: email.from,
    message: email.body,
    date: email.timestamp,
    files: email.attachments
  };
}

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'mail-formatter',
  brokers: [KAFKA_BROKER]
});

// Create consumer and producer
const consumer: Consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });
const producer: Producer = kafka.producer();

// Process each message
async function processMessage(payload: EachMessagePayload): Promise<void> {
  const { message } = payload;
  
  if (!message.value) {
    console.warn('Received message with no value, skipping...');
    return;
  }

  try {
    // Parse incoming email
    const email: EmailMessage = JSON.parse(message.value.toString());
    console.log(`Processing email from ${email.from} (ID: ${email.messageId})`);

    // Transform to ticket format
    const ticket: Ticket = formatEmailToTicket(email);

    // Send to output topic
    await producer.send({
      topic: KAFKA_OUTPUT_TOPIC,
      messages: [
        {
          key: ticket.id,
          value: JSON.stringify(ticket)
        }
      ]
    });

    console.log(`✓ Formatted and sent ticket ${ticket.id} to ${KAFKA_OUTPUT_TOPIC}`);
  } catch (error) {
    console.error('Error processing message:', error);
    if (message.value) {
      console.error('Message content:', message.value.toString());
    }
  }
}

// Main function
async function main() {
  console.log('Starting Mail Formatter...');
  console.log(`Kafka Broker: ${KAFKA_BROKER}`);
  console.log(`Input Topic: ${KAFKA_INPUT_TOPIC}`);
  console.log(`Output Topic: ${KAFKA_OUTPUT_TOPIC}`);
  console.log(`Consumer Group: ${KAFKA_GROUP_ID}\n`);

  try {
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

    console.log('Mail formatter is running and waiting for messages...\n');

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

// Run the formatter
main().catch(console.error);
