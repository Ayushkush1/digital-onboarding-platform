// app/api/user/notification-preferences/route.ts
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

    // Get user's notification preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notificationPreferences: true
      }
    });

    // Return default preferences if none set
    const preferences = user?.notificationPreferences || {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      documentUpdates: true,
      verificationStatus: true,
      securityAlerts: true,
      marketingEmails: false
    };

    return NextResponse.json({
      success: true,
      preferences
    });

  } catch (error: any) {
    console.error('GET_NOTIFICATION_PREFERENCES_ERROR', error);

    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred while fetching notification preferences',
      }),
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const preferences = body;

    // Validate preferences
    const validPreferences = {
      emailNotifications: typeof preferences.emailNotifications === 'boolean',
      smsNotifications: typeof preferences.smsNotifications === 'boolean',
      pushNotifications: typeof preferences.pushNotifications === 'boolean',
      documentUpdates: typeof preferences.documentUpdates === 'boolean',
      verificationStatus: typeof preferences.verificationStatus === 'boolean',
      securityAlerts: typeof preferences.securityAlerts === 'boolean',
      marketingEmails: typeof preferences.marketingEmails === 'boolean'
    };

    if (Object.values(validPreferences).some(valid => !valid)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid notification preferences format' }),
        { status: 400 }
      );
    }

    // Update user's notification preferences
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationPreferences: preferences
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'NOTIFICATION_PREFERENCES_UPDATED',
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          preferences,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });

  } catch (error: any) {
    console.error('UPDATE_NOTIFICATION_PREFERENCES_ERROR', error);

    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred while updating notification preferences',
      }),
      { status: 500 }
    );
  }
} 