# Mail Formatter

A Kafka consumer/producer service that reads emails from the `mails` topic, transforms them into a standardized ticket format, and publishes them to the `tickets_formatted` topic.

## Configuration

The service can be configured using the following environment variables:
- `KAFKA_BROKER`: The address of the Kafka broker (default: `localhost:9092`)
- `KAFKA_INPUT_TOPIC`: The Kafka topic to consume emails from (default: `mails`)
- `KAFKA_OUTPUT_TOPIC`: The Kafka topic to publish formatted tickets to (default: `tickets_formatted`)
- `KAFKA_GROUP_ID`: The consumer group ID (default: `mail-formatter-group`)

## Input Format (EmailMessage)
The service consumes emails in the following format:
- `messageId`: A unique identifier for the email (string)
- `from`: The email address of the sender (string)
- `to`: The email address of the recipient (string)
- `subject`: The subject line of the email (string)
- `body`: The content of the email (string)
- `timestamp`: The date and time when the email was generated (string in ISO 8601 format)
- `attachments`: A list of file names attached to the email (list of strings)

## Output Format (Ticket)
The service produces tickets in the following format:
- `id`: A unique identifier for the ticket (string, from messageId)
- `sender`: The name/email of the sender (string)
- `message`: The content of the ticket (string, from body)
- `date`: The date and time when the ticket was created (string in ISO 8601 format)
- `files`: A list of file names associated with the ticket (list of strings)

## Language

The mail formatter is implemented in TypeScript and uses the `kafkajs` library to interact with the Kafka broker as both a consumer and producer.

## Usage

To run the mail formatter, follow these steps:
1. Install the dependencies by running `pnpm install`.
2. Set the required environment variables (`KAFKA_BROKER`, `KAFKA_INPUT_TOPIC`, `KAFKA_OUTPUT_TOPIC`) as needed.
3. Start the formatter by running `pnpm start`.

The service will continuously consume messages from the input topic, transform them, and produce to the output topic.

## Docker

To build and run the service with Docker:

```bash
docker build -t mail-formatter .
docker run -e KAFKA_BROKER=kafka:9092 mail-formatter
```
