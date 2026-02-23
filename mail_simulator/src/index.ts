import { Kafka, Producer } from 'kafkajs';
import { faker } from '@faker-js/faker';

// Configuration from environment variables
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'mails';
const MESSAGE_INTERVAL = parseInt(process.env.MESSAGE_INTERVAL || '1', 10) * 1000;
const DRY_RUN = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';

// Email message interface
interface EmailMessage {
  email_id: string;
  sender: string;
  message: string;
  date: string;
  files: string[];
}

// Possible issue types for customer support emails
const issueTypes = [
  // Login & Authentication Issues
  'Unable to login to my account',
  'Password reset email not received',
  'Two-factor authentication not working',
  'Session expires too quickly',
  'Account locked after failed login attempts',
  'SSO integration not working',
  'Cannot login with social media accounts',
  
  // Performance Issues
  'Application crashes when uploading files',
  'Slow performance on mobile app',
  'Page load times are extremely long',
  'Application freezes during use',
  'High memory usage causing device slowdown',
  'Videos buffer constantly despite good internet',
  'Dashboard takes forever to load',
  
  // Payment & Billing Issues
  'Payment not processed correctly',
  'Charged twice for the same subscription',
  'Unable to update payment method',
  'Invoice not generated after payment',
  'Refund not received',
  'Subscription automatically renewed without notice',
  'Cannot cancel my subscription',
  'Promo code not working at checkout',
  
  // Feature Access Issues
  'Cannot access premium features',
  'Features missing after subscription upgrade',
  'API rate limit too restrictive',
  'Cannot download my data',
  'Export feature not working',
  'Import functionality failing',
  
  // Data Issues
  'Data synchronization issues',
  'Missing data after recent update',
  'Data lost after system migration',
  'Duplicate entries appearing',
  'Cannot restore from backup',
  'Files corrupted after upload',
  'Data export incomplete',
  
  // Notification Issues
  'Email notifications not received',
  'Push notifications not working',
  'Notification settings not saving',
  'Receiving too many spam notifications',
  'Cannot unsubscribe from marketing emails',
  
  // UI/UX Issues
  'Error message when saving settings',
  'Profile picture upload failed',
  'Search functionality returns no results',
  'Dark mode not working properly',
  'Mobile responsive design broken',
  'Buttons not clickable on certain pages',
  'Form validation errors are confusing',
  
  // Integration Issues
  'Integration with third-party service failed',
  'API authentication errors',
  'Webhook not triggering',
  'Calendar sync not working',
  'Email client integration broken',
  'Cloud storage connection failed',
  
  // Account Management
  'Cannot delete account',
  'Unable to change email address',
  'Profile information not updating',
  'Cannot merge duplicate accounts',
  'Privacy settings not being respected',
  
  // Feature Requests & Enhancements
  'Feature request: Add dark mode to the dashboard',
  'Would like bulk operations for multiple items',
  'Need to export data to Excel format',
  'Suggestion: Add mobile app for iOS',
  'Enhancement: Implement drag and drop functionality',
  'Would appreciate filtering options in reports',
  'Please add support for multiple languages',
  'Can you integrate with Slack?',
  'Feature request: Customizable dashboard widgets',
  'Need offline mode support',
  'Suggestion: Advanced search with filters',
  'Would like automated backup scheduling',
  'Request for team collaboration features',
  'Need custom branding options',
  'API documentation needs improvement',
  'Feature request: Keyboard shortcuts support',
  'Enhancement: Real-time notifications',
  'Would like an advanced analytics dashboard',
  'Need role-based access control',
  'Suggestion: Version history for documents',
  
  // Mobile-Specific Issues
  'Mobile app crashes on startup',
  'Touch gestures not responsive',
  'Cannot rotate screen properly',
  'Biometric authentication not working',
  'Mobile app draining battery',
  
  // Security & Privacy
  'Suspicious activity detected on my account',
  'Need to report a security vulnerability',
  'Privacy policy concerns',
  'GDPR data deletion request',
  'Unable to enable encryption',
  
  // Miscellaneous
  'Documentation is outdated',
  'Tutorial videos not loading',
  'Browser compatibility issues',
  'Timezone settings incorrect',
  'Language translation errors',
  'Accessibility features not working'
];

// Possible file attachments
const fileTypes = [
  'screenshot.png',
  'error_log.txt',
  'video_recording.mp4',
  'system_info.pdf',
  'network_trace.har',
  'debug_info.json'
];

// Message building blocks
const timeFrames = [
  'I have been experiencing this issue for the past 3 days',
  'This problem started after the latest update',
  'Since yesterday, I am unable to use the application',
  'For the last week, this issue has been occurring',
  'This morning I noticed that',
  'After migrating to the new version'
];

const impacts = [
  'and it is affecting my work significantly',
  'and it is blocking my entire team',
  'which is causing serious disruption to our business',
  'and I have an important deadline tomorrow',
  'and our customers are starting to complain',
  'which is unacceptable for a paid service'
];

const attempts = [
  'I have tried restarting the application multiple times but the problem persists.',
  'I have cleared my cache and cookies as suggested in the FAQ, but nothing changed.',
  'I have followed all the troubleshooting steps in your documentation without success.',
  'I tried contacting support via chat but they were unable to help.',
  'I have reinstalled the application but the issue remains.',
  'I have tested this on multiple devices with the same result.'
];

const contexts = [
  'The issue occurs every time I try to perform this action.',
  'Several of my colleagues are experiencing the same problem.',
  'This is intermittent and happens randomly, making it difficult to reproduce.',
  'The problem only occurs on mobile network but works fine on WiFi.',
  'I have attached screenshots showing the exact error messages.',
  'The error message is not very helpful and I am not sure what to do next.'
];

const urgencies = [
  'I need this resolved urgently.',
  'This is a critical issue for our operations.',
  'Please escalate this to your technical team.',
  'I would appreciate your immediate assistance.',
  'Please help me resolve this as soon as possible.',
  'I really need expert help on this matter.'
];

// Generate a random email message
function generateEmail(): EmailMessage {
  const issueType = faker.helpers.arrayElement(issueTypes);
  const timeFrame = faker.helpers.arrayElement(timeFrames);
  const impact = faker.helpers.arrayElement(impacts);
  const attempt = faker.helpers.arrayElement(attempts);
  const context = faker.helpers.arrayElement(contexts);
  const urgency = faker.helpers.arrayElement(urgencies);
  
  const numFiles = faker.number.int({ min: 0, max: 3 });
  const files = numFiles > 0 
    ? faker.helpers.arrayElements(fileTypes, numFiles)
    : [];

  const message = `Hello Support Team,\n\n${issueType}.\n\n${timeFrame} ${impact}. ${attempt} ${context}\n\n${urgency}\n\nThank you,\n${faker.person.firstName()}`;

  return {
    email_id: faker.string.uuid(),
    sender: faker.internet.email(),
    message,
    date: new Date().toISOString(),
    files
  };
}

// Initialize Kafka producer
async function createProducer(): Promise<Producer> {
  const kafka = new Kafka({
    clientId: 'mail-simulator',
    brokers: [KAFKA_BROKER]
  });

  const producer = kafka.producer();
  await producer.connect();
  console.log('Connected to Kafka broker:', KAFKA_BROKER);
  return producer;
}

// Send email to Kafka
async function sendEmail(producer: Producer, email: EmailMessage): Promise<void> {
  await producer.send({
    topic: KAFKA_TOPIC,
    messages: [
      {
        key: email.email_id,
        value: JSON.stringify(email)
      }
    ]
  });
  console.log(`Sent email from ${email.sender} (ID: ${email.email_id})`);
}

// Main function
async function main() {
  console.log('Starting Mail Simulator...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (No Kafka)' : 'Production'}`);
  console.log(`Kafka Broker: ${KAFKA_BROKER}`);
  console.log(`Kafka Topic: ${KAFKA_TOPIC}`);
  console.log(`Message Interval: ${MESSAGE_INTERVAL / 1000}s\n`);

  let producer: Producer | null = null;

  try {
    if (!DRY_RUN) {
      producer = await createProducer();
    } else {
      console.log('DRY RUN mode: Skipping Kafka connection\n');
    }

    // Send emails at regular intervals
    setInterval(async () => {
      try {
        const email = generateEmail();
        if (DRY_RUN) {
          console.log('\n--- Generated Email ---');
          console.log(JSON.stringify(email, null, 2));
          console.log('--- End Email ---\n');
        } else {
          await sendEmail(producer!, email);
        }
      } catch (error) {
        console.error('Error sending email:', error);
      }
    }, MESSAGE_INTERVAL);

  } catch (error) {
    console.error('Fatal error:', error);
    if (producer) {
      await producer.disconnect();
    }
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    if (producer) {
      await producer.disconnect();
      console.log('Disconnected from Kafka');
    }
    process.exit(0);
  });
}

// Run the simulator
main().catch(console.error);
