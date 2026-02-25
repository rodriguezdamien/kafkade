import { NextRequest, NextResponse } from 'next/server';
import { fetchMessagesFromTopic } from '@/lib/kafka';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { topic: string } }
) {
  try {
    const topic = params.topic;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    
    const messages = await fetchMessagesFromTopic(topic, limit);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error in messages API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
