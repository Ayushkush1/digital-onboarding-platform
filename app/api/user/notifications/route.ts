// app/api/user/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Helper to get the current user ID from cookies
const getCurrentUserId = (): string | null => {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;

  try {
    const session = JSON.parse(sessionCookie);
    return session.userId || null;
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    // Get notifications for the user
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20 // Limit to last 20 notifications
    });

    return NextResponse.json({
      success: true,
      notifications
    });

  } catch (error: any) {
    console.error('NOTIFICATIONS_ERROR', error);

    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred while fetching notifications',
      }),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return new NextResponse(
        JSON.stringify({ error: 'Notification ID is required' }),
        { status: 400 }
      );
    }

    // Mark notification as read
    await prisma.notification.update({
      where: { 
        id: notificationId,
        userId // Ensure user can only mark their own notifications as read
      },
      data: { read: true }
    });

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error: any) {
    console.error('MARK_NOTIFICATION_READ_ERROR', error);

    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred while marking notification as read',
      }),
      { status: 500 }
    );
  }
} 