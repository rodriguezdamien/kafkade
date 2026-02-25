# Mail Simulator

A mail simulator that sends customer support emails to Kafka. Each email represents a problem report related to the application and may contain:
- A description of the issue
- Customer requirements or requests  
- Media attachments

## Configuration

The service can be configured using the following environment variables:
- `KAFKA_BROKER`: The address of the Kafka broker (default: `localhost:9092`)
- `KAFKA_TOPIC`: The name of the Kafka topic to send messages to (default: `mails`)
- `MESSAGE_INTERVAL`: The interval (in seconds) between sending messages (default: `1`)
- `DRY_RUN`: Set to `true` or `1` to run in test mode without connecting to Kafka (default: `false`)

## Message Format
The generated emails are in JSON format and contain the following fields:
- email_id : A unique identifier for the email. (string)
- sender : The email/name of the sender. (string)
- message : The content of the mail. (string)
- date : The date and time when the email was generated. (string in ISO 8601 format)
- files : A list of file names associated with the email. (list of strings)

## Language

The mail simulator is implemented in TypeScript and uses the `kafkajs` library to interact with the Kafka broker. It also uses the `@faker-js/faker` library to generate random data for the emails.

## Usage

To run the mail simulator, follow these steps:
1. Install the dependencies by running `pnpm install`.
2. Set the required environment variables (`KAFKA_BROKER`, `KAFKA_TOPIC`, `MESSAGE_INTERVAL`) as needed.
3. Start the simulator by running `pnpm start`.

### Testing without Kafka

To test the mail generator without connecting to Kafka, use the DRY_RUN mode:

```bash
DRY_RUN=true pnpm dev
```

This will generate and display emails in the console without attempting to connect to Kafka.
