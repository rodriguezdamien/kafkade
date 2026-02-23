# Ticket-Labeller

## What's this ?

The ticket-labeller is a program made in typescript that pulls messages from Formatted tickets queue in Kafka with KafkaJS and gives them labels using OpenRouter Free AI models, turning them into labelled tickets.

It will then send it to the Labeled Tickets queue in Kafka.

Here are the differents labels, there can be multiple labels for a single ticket: 
  - Mobile
  - Web
  - Back-end
  - Infra

Here are the differentes types, there can be only one type:
  - bug
  - feature
  - question
    
There are also Priorities, that goes from 0 (Most important) to 3 (Least important).

Here is how the returned labelled tickets JSON would look:
```
{
  "id": "123456789",
  "sender": "user@example.com",
  "content": "This is a sample ticket content.",
  "labels": ["Mobile", "Front-end"],
  "type": "bug",
  "date": "2026-01-03T12:00:00Z",
  "priority": 1
}
```

## Labelling Process
In order to labels the tickets, prioritizes and define a type, we use OpenRouter to call free models (we precise multiple ones so we have fallbacks) using the [OpenRouter TypeScript SDK](https://www.npmjs.com/package/@openrouter/sdk), and prompt them to format the ticket in the way we want. The prompt is as follows:

```
You are a support ticket labeller. You receive a support ticket with the following content: 
{
  "content": "This is a sample ticket content.",
  "sender": "user@example.com",
  "id": "123456789",
  "date": "2026-01-03T12:00:00Z"
}
Your task is to label this ticket with the following labels: Mobile, Web, Back-end, Infra. You can choose multiple labels for a single ticket. You also need to define the type of the ticket, which can be either bug, feature or question. Finally, you need to prioritize the ticket from 0 (Most important) to 3 (Least important).

Your answer should be a JSON with the following format:
{
  "id": "123456789",
  "labels": ["Mobile", "Front-end"],
  "type": "bug",
  "priority": 1
}
```
