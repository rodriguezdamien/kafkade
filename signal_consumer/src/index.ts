import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';

interface InputSignalMessage {
  signal_id: string;
  sender: string;
  message: string;
  date: string;
  files: string[];
  signal_instance: string;
  emojis?: string[];
}

interface OutputTicketMessage {
  id: string;
  sender: string;
  message: string;
  date: string;
  files: string[];
}

class SignalConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private inputTopic: string;
  private outputTopic: string;
  private dlqTopic: string;

  constructor() {
    const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
    this.inputTopic = process.env.INPUT_KAFKA_TOPIC || 'signals';
    this.outputTopic = process.env.OUTPUT_KAFKA_TOPIC || 'tickets_formatted';
    this.dlqTopic = process.env.KAFKA_DLQ_TOPIC || 'signal_dlq';

    this.kafka = new Kafka({
      clientId: 'signal-consumer',
      brokers: [kafkaBroker],
      retry: {
        retries: 10,
        initialRetryTime: 300,
        multiplier: 2,
      },
    });

    this.consumer = this.kafka.consumer({ 
      groupId: 'signal-consumer-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    
    this.producer = this.kafka.producer();
  }

  private transformMessage(input: InputSignalMessage): OutputTicketMessage {
    return {
      id: input.signal_id,
      sender: input.sender,
      message: input.message,
      date: input.date,
      files: input.files,
    };
  }

  async start(): Promise<void> {
    console.log('Starting Signal Consumer...');
    console.log(`Kafka Broker: ${process.env.KAFKA_BROKER || 'localhost:9092'}`);
    console.log(`Input Topic: ${this.inputTopic}`);
    console.log(`Output Topic: ${this.outputTopic}`);
    console.log(`DLQ Topic: ${this.dlqTopic}`);

    await this.consumer.connect();
    await this.producer.connect();
    console.log('Connected to Kafka');

    await this.consumer.subscribe({ 
      topic: this.inputTopic, 
      fromBeginning: false 
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        try {
          if (!message.value) {
            console.log('Received empty message, skipping...');
            return;
          }

          const inputMessage: InputSignalMessage = JSON.parse(message.value.toString());
          const outputMessage = this.transformMessage(inputMessage);

          await this.producer.send({
            topic: this.outputTopic,
            messages: [
              {
                key: outputMessage.id,
                value: JSON.stringify(outputMessage),
              },
            ],
          });

          console.log(`Transformed message: ${inputMessage.signal_id} -> ${outputMessage.id} from ${outputMessage.sender}`);
        } catch (error) {
          console.error('Error processing message:', error);
          if (message.value) {
            console.error('Message content:', message.value.toString());
          }

          // Send failed message to Dead Letter Queue
          try {
            // Preserve original headers and add error metadata
            const dlqHeaders: Record<string, string> = {
              'error-message': error instanceof Error ? error.message : String(error),
              'error-timestamp': new Date().toISOString(),
              'original-topic': topic,
              'original-partition': partition.toString(),
              'original-offset': message.offset,
              'original-timestamp': message.timestamp
            };

            // Include original headers if present
            if (message.headers) {
              Object.entries(message.headers).forEach(([key, value]) => {
                dlqHeaders[`original-header-${key}`] = value?.toString() || '';
              });
            }

            await this.producer.send({
              topic: this.dlqTopic,
              messages: [
                {
                  key: message.key?.toString() || null,
                  value: message.value,
                  headers: dlqHeaders
                }
              ]
            });
            console.log(`Message sent to DLQ: ${this.dlqTopic} (offset: ${message.offset}, partition: ${partition})`);
          } catch (dlqError) {
            console.error('Failed to send message to DLQ:', dlqError);
          }
        }
      },
    });
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
    await this.producer.disconnect();
    console.log('Disconnected from Kafka');
  }
}

const consumer = new SignalConsumer();

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await consumer.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await consumer.stop();
  process.exit(0);
});

consumer.start().catch((error) => {
  console.error('Failed to start consumer:', error);
  process.exit(1);
});
