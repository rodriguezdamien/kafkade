import { NextRequest, NextResponse } from 'next/server';
import { listTopics } from '@/lib/kafka';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    console.log('[API /api/topics] Request received');
    const topics = await listTopics();
    console.log('[API /api/topics] Topics fetched:', topics);
    return NextResponse.json({ topics });
  } catch (error) {
    console.error('[API /api/topics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch topics' },
      { status: 500 }
    );
  }
}
