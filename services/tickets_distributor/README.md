# Tickets Distributor

A Kafka consumer/producer service that reads tickets from the `tickets_labelized` topic, identifies them and creates a topic for each ticket. Each ticket is then published to its corresponding topic with the ticket's ID as the topic name with a prefix `ticket`.

## Configuration

The service can be configured using the following environment variables:
- `KAFKA_BROKER`: The address of the Kafka broker (default: `localhost:9092`)
- `KAFKA_INPUT_TOPIC`: The Kafka topic to consume emails from (default: `tickets_labelized`)
- `KAFKA_OUTPUT_TOPIC_PREFIX`: The Kafka topic to publish formatted tickets to (default: `ticket`)
- `KAFKA_GROUP_ID`: The consumer group ID (default: `tickets-distributor-group`)

## Objective

This will allow to have a topic for each ticket and later allow messages to be send concerning a specific ticket to its corresponding topic. For example, if a ticket has an ID of `12345`, it will be published to the topic `ticket-12345`. This way, any messages related to that ticket can be sent to the same topic, making it easier to track and manage conversations around that ticket.

## Language

The mail formatter is implemented in TypeScript and uses the `kafkajs` library to interact with the Kafka broker as both a consumer and producer.

## Usage

To run the ticket distributor, follow these steps:
1. Install the dependencies by running `pnpm install`.
2. Set the required environment variables (`KAFKA_BROKER`, `KAFKA_INPUT_TOPIC`, `KAFKA_OUTPUT_TOPIC_PREFIX`) as needed.
3. Start the formatter by running `pnpm start`.

The service will continuously consume messages from the input topic, transform them, and produce to the output topic.

## Docker

To build and run the service with Docker:

```bash
docker build -t tickets-distributor .
docker run -e KAFKA_BROKER=kafka:9092 tickets-distributor
```
