import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import { OpenRouter } from '@openrouter/sdk';

// ─── Configuration ────────────────────────────────────────────────────────────

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const INPUT_TOPIC = 'formatted-tickets';
const OUTPUT_TOPIC = 'labeled-tickets';
const DLQ_TOPIC = 'labeled-tickets-dlq';
const CONSUMER_GROUP = 'ticket-labeller';

const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormattedTicket {
  id: string;
  sender: string;
  content: string;
  date: string;
}

type Label = 'Mobile' | 'Web' | 'Back-end' | 'Infra';
type TicketType = 'bug' | 'feature' | 'question';

interface AIResponse {
  id: string;
  labels: Label[];
  type: TicketType;
  priority: number;
}

interface LabeledTicket {
  id: string;
  sender: string;
  content: string;
  labels: Label[];
  type: TicketType;
  date: string;
  priority: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_LABELS: Label[] = ['Mobile', 'Web', 'Back-end', 'Infra'];
const VALID_TYPES: TicketType[] = ['bug', 'feature', 'question'];

function validateAIResponse(data: unknown, ticketId: string): AIResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('AI response is not an object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.id !== ticketId) {
    console.warn(`[warn] AI returned id "${obj.id}", expected "${ticketId}". Correcting.`);
    obj.id = ticketId;
  }

  if (!Array.isArray(obj.labels) || obj.labels.length === 0) {
    throw new Error(`Invalid labels: ${JSON.stringify(obj.labels)}`);
  }
  for (const label of obj.labels) {
    if (!VALID_LABELS.includes(label as Label)) {
      throw new Error(`Invalid label: "${label}". Must be one of ${VALID_LABELS.join(', ')}`);
    }
  }

  if (!VALID_TYPES.includes(obj.type as TicketType)) {
    throw new Error(`Invalid type: "${obj.type}". Must be one of ${VALID_TYPES.join(', ')}`);
  }

  const priority = Number(obj.priority);
  if (!Number.isInteger(priority) || priority < 0 || priority > 3) {
    throw new Error(`Invalid priority: "${obj.priority}". Must be an integer between 0 and 3`);
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
      content: ticket.content,
      sender: ticket.sender,
      id: ticket.id,
      date: ticket.date,
    },
    null,
    2,
  );

  return `You are a support ticket labeller. You receive a support ticket with the following content: 
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
  // Try to extract a JSON object from the response text (handles markdown fences, etc.)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in AI response');
  }
  return JSON.parse(jsonMatch[0]);
}

async function labelTicket(
  openRouter: OpenRouter,
  ticket: FormattedTicket,
): Promise<AIResponse> {
  const prompt = buildPrompt(ticket);

  let lastError: Error | null = null;

  for (const model of FREE_MODELS) {
    try {
      console.log(`[ai] Trying model "${model}" for ticket ${ticket.id}...`);

      const result = await openRouter.chat.send({
        chatGenerationParams: {
          model,
          messages: [
            {
              role: 'user' as const,
              content: prompt,
            },
          ],
          responseFormat: { type: 'json_object' as const },
          stream: false,
        },
      });

      // The result is a ChatResponse when stream is false
      const chatResponse = result as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };

      const content = chatResponse.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Empty or invalid response from AI model');
      }

      console.log(`[ai] Raw response from "${model}": ${content}`);

      const parsed = extractJSON(content);
      const validated = validateAIResponse(parsed, ticket.id);

      console.log(`[ai] Successfully labelled ticket ${ticket.id} with model "${model}"`);
      return validated;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[ai] Model "${model}" failed for ticket ${ticket.id}: ${lastError.message}`);
    }
  }

  throw new Error(
    `All models failed to label ticket ${ticket.id}. Last error: ${lastError?.message}`,
  );
}

// ─── Kafka helpers ────────────────────────────────────────────────────────────

async function sendToDLQ(
  producer: Producer,
  key: string | null,
  value: string,
  reason: string,
): Promise<void> {
  await producer.send({
    topic: DLQ_TOPIC,
    messages: [
      {
        key: key ?? undefined,
        value,
        headers: { error: reason },
      },
    ],
  });
  console.log(`[dlq] Record (key=${key}) sent to ${DLQ_TOPIC} — reason: ${reason}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

class TicketLabeller {
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private openRouter: OpenRouter;

  constructor() {
    if (!OPENROUTER_API_KEY) {
      console.warn(
        '[warn] OPENROUTER_API_KEY is not set. AI labelling will fail. ' +
          'Set the OPENROUTER_API_KEY environment variable.',
      );
    }

    this.kafka = new Kafka({
      clientId: 'ticket-labeller',
      brokers: [KAFKA_BROKER],
      retry: {
        retries: 10,
        initialRetryTime: 300,
        multiplier: 2,
      },
    });

    this.consumer = this.kafka.consumer({ groupId: CONSUMER_GROUP });
    this.producer = this.kafka.producer();

    this.openRouter = new OpenRouter({
      apiKey: OPENROUTER_API_KEY,
    });
  }

  private async processMessage({ topic, partition, message }: EachMessagePayload): Promise<void> {
    const rawValue = message.value?.toString();
    const rawKey = message.key?.toString() ?? null;

    if (!rawValue) {
      console.warn(`[skip] Empty message on ${topic}[${partition}]`);
      return;
    }

    console.log(`[recv] Ticket from ${topic}[${partition}] offset=${message.offset} key=${rawKey}`);

    let ticket: FormattedTicket;
    try {
      ticket = JSON.parse(rawValue) as FormattedTicket;
      if (!ticket.id || !ticket.sender || !ticket.content || !ticket.date) {
        throw new Error('Missing required fields (id, sender, content, date)');
      }
    } catch (error) {
      const reason = `Invalid formatted ticket JSON: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[error] ${reason}`);
      await sendToDLQ(this.producer, rawKey, rawValue, reason);
      return;
    }

    try {
      const aiResult = await labelTicket(this.openRouter, ticket);

      const labeled: LabeledTicket = {
        id: ticket.id,
        sender: ticket.sender,
        content: ticket.content,
        labels: aiResult.labels,
        type: aiResult.type,
        date: ticket.date,
        priority: aiResult.priority,
      };

      await this.producer.send({
        topic: OUTPUT_TOPIC,
        messages: [
          {
            key: labeled.id,
            value: JSON.stringify(labeled),
          },
        ],
      });

      console.log(
        `[send] Labeled ticket ${labeled.id} → ${OUTPUT_TOPIC} ` +
          `(labels=${labeled.labels.join(',')}, type=${labeled.type}, priority=${labeled.priority})`,
      );
    } catch (error) {
      const reason = `Labelling failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[error] ${reason}`);
      await sendToDLQ(this.producer, rawKey, rawValue, reason);
    }
  }

  async start(): Promise<void> {
    console.log('Starting Ticket Labeller...');
    console.log(`Kafka Broker:   ${KAFKA_BROKER}`);
    console.log(`Input Topic:    ${INPUT_TOPIC}`);
    console.log(`Output Topic:   ${OUTPUT_TOPIC}`);
    console.log(`DLQ Topic:      ${DLQ_TOPIC}`);
    console.log(`Consumer Group: ${CONSUMER_GROUP}`);
    console.log(`Free models:    ${FREE_MODELS.join(', ')}`);

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

    console.log('Ticket Labeller is running. Waiting for messages...');
  }

  async stop(): Promise<void> {
    console.log('Shutting down Ticket Labeller...');
    await this.consumer.disconnect();
    await this.producer.disconnect();
    console.log('Disconnected from Kafka');
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const labeller = new TicketLabeller();

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await labeller.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await labeller.stop();
  process.exit(0);
});

labeller.start().catch((error) => {
  console.error('Failed to start Ticket Labeller:', error);
  process.exit(1);
});