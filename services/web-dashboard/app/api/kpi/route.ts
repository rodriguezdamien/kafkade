import { NextResponse } from 'next/server';
import { fetchMessagesFromTopic } from '@/lib/kafka';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface KPIData {
  totalTickets: number;
  byType: Record<string, number>;
  byLabel: Record<string, number>;
  byPriority: Record<number, number>;
  byStatus: Record<string, number>;
  lastUpdate: string;
  timestamp: number;
}

export async function GET() {
  try {
    // Fetch only the latest KPI message from the end of the topic
    // This is much faster than reading all messages
    const messages = await fetchMessagesFromTopic('tickets_kpi', 1, true);
    
    if (messages.length === 0) {
      // Return empty KPI if no data yet
      return NextResponse.json({
        kpi: {
          totalTickets: 0,
          byType: { bug: 0, feature: 0, question: 0 },
          byLabel: { Mobile: 0, Web: 0, 'Back-end': 0, Infra: 0 },
          byPriority: { 0: 0, 1: 0, 2: 0, 3: 0 },
          byStatus: { open: 0, closed: 0 },
          lastUpdate: new Date().toISOString(),
          timestamp: Date.now(),
        }
      });
    }

    // Get the first (and only) message which is the most recent
    const kpi: KPIData = JSON.parse(messages[0].value);
    
    return NextResponse.json({ kpi });
  } catch (error) {
    console.error('Error in KPI API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KPI data' },
      { status: 500 }
    );
  }
}
