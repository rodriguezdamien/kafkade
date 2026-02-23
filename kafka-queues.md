## Kafka Service Setup in docker-compose

### Description

For our support ticket processing project, we will implement a Kafka instance containing the following topics:

* **WhatsApp Messages**: Messages received from WhatsApp.
* **Mail Messages**: Messages received from Mail.
* **Formatted Tickets**: Messages formatted as tickets after external processing.
* **Labeled Tickets**: Labeled messages after external processing.
* **WhatsApp Dead Letter Queue**: Failed messages from the WhatsApp Messages topic.
* **Mail Dead Letter Queue**: Failed messages from the Mail Messages topic.
* **Labeled Ticket Dead Letter Queue**: Failed messages from the Labeled Ticket topic (those that failed to transition from formatting to labeling).

**Processing Workflow:**

* **Success**: The processed message is sent to the Formatted Tickets queue.
* **Failure**: The message is sent to a Dead Letter Queue (separate queues for Mail and WhatsApp to differentiate sources).
