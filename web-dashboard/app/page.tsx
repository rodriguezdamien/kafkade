'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key: string | null;
  value: string;
  headers: Record<string, string>;
}

export default function DashboardPage() {
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [messages, setMessages] = useState<KafkaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      setTopics(data.topics || []);
      if (data.topics && data.topics.length > 0) {
        setSelectedTopic(data.topics[0]);
      }
    } catch (err) {
      console.error('Error fetching topics:', err);
      setError('Failed to fetch topics');
    }
  };

  const fetchMessages = async (topic: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/${topic}?limit=50`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTopic) {
      fetchMessages(selectedTopic);
    }
  }, [selectedTopic]);

  const parseValue = (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const getTopicIcon = (topic: string) => {
    if (topic.includes('dlq')) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    } else if (topic.includes('formatted') || topic.includes('labeled')) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Kafka Queue Dashboard</h1>
            <p className="text-muted-foreground mt-2">Monitor and inspect your Kafka topics and messages</p>
          </div>
          <Button onClick={() => selectedTopic && fetchMessages(selectedTopic)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Topics Navigation */}
        <Card>
          <CardHeader>
            <CardTitle>Topics</CardTitle>
            <CardDescription>Select a topic to view messages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <Button
                  key={topic}
                  variant={selectedTopic === topic ? 'default' : 'outline'}
                  onClick={() => setSelectedTopic(topic)}
                  className="flex items-center gap-2"
                >
                  {getTopicIcon(topic)}
                  {topic}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Messages Display */}
        {selectedTopic && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getTopicIcon(selectedTopic)}
                Messages from {selectedTopic}
              </CardTitle>
              <CardDescription>
                {messages.length} message{messages.length !== 1 ? 's' : ''} (latest 50)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  No messages found in this topic
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <Card key={`${msg.offset}-${idx}`} className="bg-muted/50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-mono bg-primary/10 px-2 py-1 rounded">
                              Offset: {msg.offset}
                            </span>
                            <span className="text-muted-foreground">
                              Partition: {msg.partition}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(parseInt(msg.timestamp)).toLocaleString()}
                            </span>
                          </div>
                          {msg.key && (
                            <span className="text-xs font-mono bg-secondary px-2 py-1 rounded">
                              Key: {msg.key}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Headers */}
                        {Object.keys(msg.headers).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Headers:</h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(msg.headers).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="text-xs font-mono bg-accent px-2 py-1 rounded"
                                >
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Message Value */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Message:</h4>
                          <pre className="bg-card p-3 rounded-md overflow-x-auto text-xs border">
                            {JSON.stringify(parseValue(msg.value), null, 2)}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
