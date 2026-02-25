# Ticket-Labelizer

## What's This?

The Ticket-Labelizer is a TypeScript service that consumes messages from the formatted tickets queue in Kafka (using KafkaJS), enriches them with labels, a type, and a priority using a local Ollama model, and then publishes the resulting labelized tickets to a downstream Kafka queue.

### Labels, Types, and Priorities

Each ticket is enriched with three pieces of metadata:

1. **Labels** — One or more of the following categories can be assigned to a single ticket:
   - `Mobile`
   - `Web`
   - `Back-end`
   - `Infra`

2. **Type** — Exactly one of the following:
   - `bug`
   - `feature`
   - `question`

3. **Priority** — An integer from `0` (most urgent) to `3` (least urgent).

### Output Format

After labelling, the service produces a JSON object with the following structure:

```json
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

To assign labels, determine the type, and set the priority, the service sends each ticket to a local Ollama model via the [ollama-js library](https://github.com/ollama/ollama-js). The model is prompted to analyse the ticket content and return structured metadata. The prompt template is as follows:

```
You are a support ticket labelizer. You receive a support ticket with the following content: 
{
  "message": "This is a sample ticket content.",
  "sender": "user@example.com",
  "id": "123456789",
  "date": "2026-01-03T12:00:00Z",
  "files": [
    "string1",
    "string2"
  ]
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
