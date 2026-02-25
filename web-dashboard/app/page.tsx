'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp, Bug, Lightbulb, HelpCircle, Target } from 'lucide-react';
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

interface KPIData {
  totalTickets: number;
  byType: Record<string, number>;
  byLabel: Record<string, number>;
  byPriority: Record<number, number>;
  byStatus?: Record<string, number>;
  lastUpdate: string;
  timestamp: number;
}

export default function DashboardPage() {
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [messages, setMessages] = useState<KafkaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  useEffect(() => {
    fetchTopics();
    fetchKPI();
    // Refresh KPI every 5 seconds
    const interval = setInterval(fetchKPI, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchKPI = async () => {
    setKpiLoading(true);
    try {
      const res = await fetch('/api/kpi');
      const data = await res.json();
      setKpi(data.kpi);
    } catch (err) {
      console.error('Error fetching KPI:', err);
    } finally {
      setKpiLoading(false);
    }
  };

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

        {/* KPI Section */}
        {kpi && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Ticket KPI</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className={`h-3 w-3 ${kpiLoading ? 'animate-spin' : ''}`} />
                {kpi.lastUpdate ? `Mis à jour: ${new Date(kpi.lastUpdate).toLocaleTimeString()}` : ''}
              </div>
            </div>

            {/* Total Tickets */}
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5" />
                  Total des Tickets Ouverts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{kpi.byStatus?.open || 0}</div>
                <p className="text-blue-100 text-sm mt-1">tickets ouverts</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* By Status */}
              {kpi.byStatus && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Par Statut</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Ouverts</span>
                      </div>
                      <span className="font-semibold">{kpi.byStatus.open || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">Fermés</span>
                      </div>
                      <span className="font-semibold">{kpi.byStatus.closed || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* By Type */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Par Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Bugs</span>
                    </div>
                    <span className="font-semibold">{kpi.byType.bug || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Features</span>
                    </div>
                    <span className="font-semibold">{kpi.byType.feature || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Questions</span>
                    </div>
                    <span className="font-semibold">{kpi.byType.question || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* By Priority */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Par Priorité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-600" />
                      <span className="text-sm">Critique (0)</span>
                    </div>
                    <span className="font-semibold">{kpi.byPriority[0] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Haute (1)</span>
                    </div>
                    <span className="font-semibold">{kpi.byPriority[1] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Moyenne (2)</span>
                    </div>
                    <span className="font-semibold">{kpi.byPriority[2] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Basse (3)</span>
                    </div>
                    <span className="font-semibold">{kpi.byPriority[3] || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* By Label */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Par Label</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">📱 Mobile</span>
                    <span className="font-semibold">{kpi.byLabel.Mobile || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">🌐 Web</span>
                    <span className="font-semibold">{kpi.byLabel.Web || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">⚙️ Back-end</span>
                    <span className="font-semibold">{kpi.byLabel['Back-end'] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">🏗️ Infra</span>
                    <span className="font-semibold">{kpi.byLabel.Infra || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

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
