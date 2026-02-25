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
    // Fetch all KPI messages from the tickets_kpi topic from the beginning
    // We need to get all messages to find the latest one
    const messages = await fetchMessagesFromTopic('tickets_kpi', 1000, false);
    
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

    // Get the message with the highest timestamp (most recent)
    const latestMessage = messages.reduce((latest, current) => {
      const currentKpi: KPIData = JSON.parse(current.value);
      const latestKpi: KPIData = JSON.parse(latest.value);
      return currentKpi.timestamp > latestKpi.timestamp ? current : latest;
    });
    
    const kpi: KPIData = JSON.parse(latestMessage.value);
    
    return NextResponse.json({ kpi });
  } catch (error) {
    console.error('Error in KPI API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KPI data' },
      { status: 500 }
    );
  }
}
