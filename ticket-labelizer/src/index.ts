import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import { Ollama } from 'ollama';

// ─── Configuration ────────────────────────────────────────────────────────────

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

const INPUT_TOPIC = process.env.KAFKA_INPUT_TOPIC || 'tickets_formatted';
const OUTPUT_TOPIC = process.env.KAFKA_OUTPUT_TOPIC || 'tickets_labelized';
const DLQ_TOPIC = process.env.KAFKA_DLQ_TOPIC || 'labelized_tickets_dlq';
const CONSUMER_GROUP = process.env.KAFKA_GROUP_ID || 'ticket-labelizer-group';

const MESSAGE_INTERVAL_MS = Number(process.env.MESSAGE_INTERVAL_MS) || 10_000; // 10s between AI calls

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormattedTicket {
  id: string;
  sender: string;
  message: string;
  date: string;
  files?: string[];
}

type Label = 'Mobile' | 'Web' | 'Back-end' | 'Infra' | 'Front-end';
type TicketType = 'bug' | 'feature' | 'question' | 'suggestion';

interface AIResponse {
  id: string;
  labels: Label[];
  type: TicketType;
  priority: number;
}

interface LabelizedTicket {
  id: string;
  sender: string;
  message: string;
  labels: Label[];
  type: TicketType;
  date: string;
  files?: string[];
  priority: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_LABELS: Label[] = ['Mobile', 'Web', 'Back-end', 'Infra', 'Front-end'];
const VALID_TYPES: TicketType[] = ['bug', 'feature', 'question', 'suggestion'];

function validateAIResponse(data: unknown, ticketId: string): AIResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('AI response is not an object');
  }

  const obj = data as Record<string, unknown>;

  // Correct the id if the model returned a different one
  if (obj.id !== ticketId) {
    console.warn(`[warn] AI returned id "${obj.id}", expected "${ticketId}". Correcting.`);
    obj.id = ticketId;
  }

  // Validate labels
  if (!Array.isArray(obj.labels) || obj.labels.length === 0) {
    throw new Error(`Invalid labels: ${JSON.stringify(obj.labels)}`);
  }
  for (const label of obj.labels) {
    if (!VALID_LABELS.includes(label as Label)) {
      throw new Error(`Invalid label: "${label}". Must be one of ${VALID_LABELS.join(', ')}`);
    }
  }

  // Validate type
  if (!VALID_TYPES.includes(obj.type as TicketType)) {
    throw new Error(`Invalid type: "${obj.type}". Must be one of ${VALID_TYPES.join(', ')}`);
  }

  // Validate priority
  const priority = Number(obj.priority);
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) {
    throw new Error(`Invalid priority: "${obj.priority}". Must be an integer between 0 and 5`);
  }

  return {
    id: String(obj.id),
    labels: obj.labels as Label[],
    type: obj.type as TicketType,
    priority,
  };
}

// ─── AI Labelling ─────────────────────────────────────────────────────────────

function buildPrompt(ticket: FormattedTicket): string {
  const ticketJson = JSON.stringify(
    {
      message: ticket.message,
      sender: ticket.sender,
      id: ticket.id,
      date: ticket.date,
      files: ticket.files,
    },
    null,
    2,
  );

  return `You are a support ticket labelizer. You receive a support ticket with the following content: 
${ticketJson}

Your task is to label this ticket with the following labels: Mobile, Web, Back-end, Infra. You can choose multiple labels for a single ticket. You also need to define the type of the ticket, which can be either bug, feature or question. Finally, you need to prioritize the ticket from 0 (Most important) to 3 (Least important).

Your answer should be a JSON with the following format:
{
  "id": "${ticket.id}",
  "labels": ["Mobile", "Front-end"],
  "type": "bug",
  "priority": 1
}

Answer ONLY with the JSON object, no additional text.`;
}

function extractJSON(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in AI response');
  }
  // return will throw if the JSON is invalid
  return JSON.parse(jsonMatch[0]);
}

async function labelTicket(
  ollama: Ollama,
  ticket: FormattedTicket,
): Promise<AIResponse> {
  const prompt = buildPrompt(ticket);

  console.log(`[ai] Sending ticket ${ticket.id} to Ollama model "${OLLAMA_MODEL}"...`);

  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    format: 'json',
    stream: false,
  });

  const content = response.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Empty or invalid response from Ollama model');
  }

  console.log(`[ai] Raw response: ${content}`);

  const parsed = extractJSON(content);
  const validated = validateAIResponse(parsed, ticket.id);

  console.log(`[ai] Successfully labelized ticket ${ticket.id}`);
  return validated;
}

// ─── Kafka helpers ────────────────────────────────────────────────────────────

async function sendToDLQ(
  producer: Producer,
  key: string | null,
  value: Buffer | null,
  reason: string,
  originalTopic: string,
  originalPartition: number,
  originalOffset: string,
  originalTimestamp: string,
  originalHeaders?: Record<string, Buffer | string | undefined>,
): Promise<void> {
  const dlqHeaders: Record<string, string> = {
    'error-message': reason,
    'error-timestamp': new Date().toISOString(),
    'original-topic': originalTopic,
    'original-partition': originalPartition.toString(),
    'original-offset': originalOffset,
    'original-timestamp': originalTimestamp,
  };

  if (originalHeaders) {
    Object.entries(originalHeaders).forEach(([k, v]) => {
      dlqHeaders[`original-header-${k}`] = v?.toString() || '';
    });
  }

  await producer.send({
    topic: DLQ_TOPIC,
    messages: [
      {
        key: key ?? undefined,
        value: value,
        headers: dlqHeaders,
      },
    ],
  });

  console.log(`[dlq] Record (key=${key}) sent to ${DLQ_TOPIC} — reason: ${reason}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

class Ticketlabelizer {
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private ollama: Ollama;
  private isFirstMessage: boolean = true;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'ticket-labelizer',
      brokers: [KAFKA_BROKER],
      retry: {
        retries: 10,
        initialRetryTime: 300,
        multiplier: 2,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: CONSUMER_GROUP,
      sessionTimeout: 60_000,
      heartbeatInterval: 10_000,
    });

    this.producer = this.kafka.producer();

    this.ollama = new Ollama({ host: OLLAMA_HOST });
  }

  private async processMessage({ topic, partition, message }: EachMessagePayload): Promise<void> {
    const rawValue = message.value?.toString();
    const rawKey = message.key?.toString() ?? null;

    if (!rawValue) {
      console.warn(`[skip] Empty message on ${topic}[${partition}]`);
      return;
    }

    console.log(`[recv] Ticket from ${topic}[${partition}] offset=${message.offset} key=${rawKey}`);

    // Throttle: wait between AI calls to avoid overwhelming Ollama
    if (!this.isFirstMessage) {
      console.log(`[throttle] Waiting ${MESSAGE_INTERVAL_MS / 1000}s before calling AI...`);
      await sleep(MESSAGE_INTERVAL_MS);
    }
    this.isFirstMessage = false;

    // Parse the incoming formatted ticket
    let ticket: FormattedTicket;
    try {
      ticket = JSON.parse(rawValue) as FormattedTicket;
      if (!ticket.id || !ticket.sender || !ticket.message || !ticket.date) {
        throw new Error('Missing required fields (id, sender, message, date)');
      }
      if (!Array.isArray(ticket.files)) {
        ticket.files = [];
      }
    } catch (error) {
      const reason = `Invalid formatted ticket JSON: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[error] ${reason}`);
      await sendToDLQ(
        this.producer,
        rawKey,
        message.value,
        reason,
        topic,
        partition,
        message.offset,
        message.timestamp,
        message.headers as Record<string, Buffer | string | undefined> | undefined,
      );
      return;
    }

    // Label via Ollama
    try {
      const aiResult = await labelTicket(this.ollama, ticket);

      const labelized: LabelizedTicket = {
        id: ticket.id,
        sender: ticket.sender,
        message: ticket.message,
        labels: aiResult.labels,
        type: aiResult.type,
        date: ticket.date,
        priority: aiResult.priority,
      };

      await this.producer.send({
        topic: OUTPUT_TOPIC,
        messages: [
          {
            key: labelized.id,
            value: JSON.stringify(labelized),
          },
        ],
      });

      console.log(
        `[send] Labelized ticket ${labelized.id} → ${OUTPUT_TOPIC} ` +
          `(labels=${labelized.labels.join(',')}, type=${labelized.type}, priority=${labelized.priority})`,
      );
    } catch (error) {
      const reason = `Labelling failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[error] ${reason}`);
      await sendToDLQ(
        this.producer,
        rawKey,
        message.value,
        reason,
        topic,
        partition,
        message.offset,
        message.timestamp,
        message.headers as Record<string, Buffer | string | undefined> | undefined,
      );
    }
  }

  async start(): Promise<void> {
    console.log('Starting Ticket labelizer...');
    console.log(`Kafka Broker:     ${KAFKA_BROKER}`);
    console.log(`Ollama Host:      ${OLLAMA_HOST}`);
    console.log(`Ollama Model:     ${OLLAMA_MODEL}`);
    console.log(`Input Topic:      ${INPUT_TOPIC}`);
    console.log(`Output Topic:     ${OUTPUT_TOPIC}`);
    console.log(`DLQ Topic:        ${DLQ_TOPIC}`);
    console.log(`Consumer Group:   ${CONSUMER_GROUP}`);
    console.log(`Throttle:         ${MESSAGE_INTERVAL_MS / 1000}s between messages`);

    await this.producer.connect();
    console.log('Producer connected to Kafka');

    await this.consumer.connect();
    console.log('Consumer connected to Kafka');

    await this.consumer.subscribe({ topic: INPUT_TOPIC, fromBeginning: false });
    console.log(`Subscribed to "${INPUT_TOPIC}"`);

    await this.consumer.run({
      eachMessage: async (payload) => {
        await this.processMessage(payload);
      },
    });

    console.log('Ticket labelizer is running. Waiting for messages...');
  }

  async stop(): Promise<void> {
    console.log('Shutting down Ticket labelizer...');
    await this.consumer.disconnect();
    console.log('Consumer disconnected');
    await this.producer.disconnect();
    console.log('Producer disconnected');
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const labelizer = new Ticketlabelizer();

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await labelizer.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await labelizer.stop();
  process.exit(0);
});

labelizer.start().catch((error) => {
  console.error('Failed to start Ticket labelizer:', error);
  process.exit(1);
});
