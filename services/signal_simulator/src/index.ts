import { Kafka, Producer } from 'kafkajs';
import { faker } from '@faker-js/faker';

interface SignalMessage {
  signal_id: string;
  sender: string;
  message: string;
  date: string;
  files: string[];
  signal_instance: string;
  emojis?: string[];
}

const problems = [
  "Hello, there is a problem with my server, I think that the application can't reach the proxy... Maybe that's a problem with the DevOps team ?",
  "I've discussed with Max yesterday, he suggested me to remove some of our features, maybe we should look at it ?",
  "My application stopped working 2 months ago and I really need it now ! When I try to login I've some sort of bug and everything crashed...",
  "Hello Senior, my support ticket is still open and I don't have any news about it, can you please check it ?",
  "Some shitty things happened on my internet, it's like the connection is stopping, can you help me ?",
  "I don't know if it's a problem with the proxy or the database but I can't access to my data, can you please check it ?",
  "My application is in french and I hate french, give me advices !"
]

class SignalSimulator {
  private kafka: Kafka;
  private producer: Producer;
  private topic: string;
  private interval: number;

  constructor() {
    const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
    this.topic = process.env.KAFKA_TOPIC || 'signals';
    this.interval = parseInt(process.env.MESSAGE_INTERVAL || '1', 10) * 1000;

    this.kafka = new Kafka({
      clientId: 'signal-simulator',
      brokers: [kafkaBroker],
      retry: {
        retries: 10,
        initialRetryTime: 300,
        multiplier: 2,
      },
    });

    this.producer = this.kafka.producer();
  }

  private generateSignalMessage(): SignalMessage {
    const fileCount = faker.number.int({ min: 0, max: 5 });
    const files = Array.from({ length: fileCount }, () => 
      faker.system.fileName()
    );

    return {
      signal_id: faker.string.uuid(),
      sender: faker.person.fullName(),
      message: problems[faker.number.int({ min: 0, max: problems.length - 1 })],
      date: new Date().toISOString(),
      signal_instance: faker.string.uuid(),
      emojis: faker.helpers.arrayElements(['😀', '🚀', '🔥', '💡', '📈'], faker.number.int({ min: 0, max: 3 })),
      files,
    };
  }

  async start(): Promise<void> {
    console.log('Starting Signal Simulator...');
    console.log(`Kafka Broker: ${process.env.KAFKA_BROKER || 'localhost:9092'}`);
    console.log(`Topic: ${this.topic}`);
    console.log(`Interval: ${this.interval / 1000}s`);

    await this.producer.connect();
    console.log('Connected to Kafka');

    setInterval(async () => {
      try {
        const message = this.generateSignalMessage();
        await this.producer.send({
          topic: this.topic,
          messages: [
            {
              key: message.signal_id,
              value: JSON.stringify(message),
            },
          ],
        });
        console.log(`Sent message: ${message.signal_id} from ${message.sender}`);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }, this.interval);
  }

  async stop(): Promise<void> {
    await this.producer.disconnect();
    console.log('Disconnected from Kafka');
  }
}

const simulator = new SignalSimulator();

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await simulator.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await simulator.stop();
  process.exit(0);
});

simulator.start().catch((error) => {
  console.error('Failed to start simulator:', error);
  process.exit(1);
});
