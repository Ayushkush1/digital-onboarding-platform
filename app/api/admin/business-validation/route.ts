// app/api/admin/business-validation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Helper to get the current admin user ID from cookies
const getCurrentAdminId = (): string | null => {
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
    const adminId = getCurrentAdminId();

    if (!adminId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    // Check if user is admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Build where clause for business validations that need review
    const where: any = {
      OR: [
        {
          tinValidationResult: {
            path: ['status'],
            equals: 'ERROR'
          }
        },
        {
          cacValidationResult: {
            path: ['status'],
            equals: 'ERROR'
          }
        },
        {
          tinValidationResult: {
            path: ['status'],
            equals: 'FAILED'
          }
        },
        {
          cacValidationResult: {
            path: ['status'],
            equals: 'FAILED'
          }
        }
      ]
    };

    // Add status filter if provided
    if (status && status !== 'all') {
      if (status === 'error') {
        where.OR = [
          {
            tinValidationResult: {
              path: ['status'],
              equals: 'ERROR'
            }
          },
          {
            cacValidationResult: {
              path: ['status'],
              equals: 'ERROR'
            }
          }
        ];
      } else if (status === 'failed') {
        where.OR = [
          {
            tinValidationResult: {
              path: ['status'],
              equals: 'FAILED'
            }
          },
          {
            cacValidationResult: {
              path: ['status'],
              equals: 'FAILED'
            }
          }
        ];
      }
    }

    // Get KYC form data that needs manual review
    const kycFormData = await prisma.kYCFormData.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            accountType: true,
            accountStatus: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.kYCFormData.count({ where });

    // Format the response
    const formattedData = kycFormData.map(data => {
      const tinStatus = data.tinValidationResult?.status || 'NOT_PROVIDED';
      const cacStatus = data.cacValidationResult?.status || 'NOT_PROVIDED';
      
      let overallStatus = 'PENDING';
      let requiresManualReview = false;
      let manualReviewReason = '';

      if (tinStatus === 'ERROR' || cacStatus === 'ERROR') {
        overallStatus = 'REQUIRES_MANUAL_REVIEW';
        requiresManualReview = true;
        manualReviewReason = `API validation errors detected. TIN: ${tinStatus}, CAC: ${cacStatus}`;
      } else if (tinStatus === 'FAILED' || cacStatus === 'FAILED') {
        overallStatus = 'REQUIRES_MANUAL_REVIEW';
        requiresManualReview = true;
        manualReviewReason = `Validation failed for some fields. TIN: ${tinStatus}, CAC: ${cacStatus}`;
      }

      return {
        id: data.id,
        userId: data.userId,
        userName: `${data.user.firstName} ${data.user.lastName}`,
        userEmail: data.user.email,
        userPhone: data.user.phone,
        accountType: data.user.accountType,
        accountStatus: data.user.accountStatus,
        rcNumber: data.rcNumber,
        companyType: data.companyType,
        tinValidation: data.tinValidationResult,
        cacValidation: data.cacValidationResult,
        overallStatus,
        requiresManualReview,
        manualReviewReason,
        submittedAt: data.submittedAt,
        updatedAt: data.updatedAt
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedData,
      pagination: {
        total: totalCount,
        page,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      }
    });

  } catch (error: any) {
    console.error('GET_BUSINESS_VALIDATIONS_ERROR', error);

    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred while fetching business validations',
      }),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminId = getCurrentAdminId();

    if (!adminId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    // Check if user is admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      userId, 
      action, // 'approve' or 'reject'
      reviewNotes,
      tinApproved = false,
      cacApproved = false
    } = body;

    if (!userId || !action) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required parameters: userId and action' }),
        { status: 400 }
      );
    }

    // Get the KYC form data
    const kycFormData = await prisma.kYCFormData.findUnique({
      where: { userId },
      include: {
        user: true
      }
    });

    if (!kycFormData) {
      return new NextResponse(
        JSON.stringify({ error: 'KYC form data not found' }),
        { status: 404 }
      );
    }

    // Update validation results based on admin decision
    const updatedTinValidation = kycFormData.tinValidationResult ? {
      ...kycFormData.tinValidationResult,
      isValid: action === 'approve' ? tinApproved : false,
      status: action === 'approve' ? 'SUCCESS' : 'FAILED',
      adminReviewed: true,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNotes
    } : null;

    const updatedCacValidation = kycFormData.cacValidationResult ? {
      ...kycFormData.cacValidationResult,
      isValid: action === 'approve' ? cacApproved : false,
      status: action === 'approve' ? 'SUCCESS' : 'FAILED',
      adminReviewed: true,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNotes
    } : null;

    // Update KYC form data
    await prisma.kYCFormData.update({
      where: { userId },
      data: {
        tinValidationResult: updatedTinValidation,
        cacValidationResult: updatedCacValidation,
        updatedAt: new Date()
      }
    });

    // Create admin review record
    await prisma.adminReview.create({
      data: {
        userId,
        reviewerId: adminId,
        verificationType: 'IDENTITY_VERIFICATION',
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewNotes,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Update verification status if approved
    if (action === 'approve') {
      const overallStatus = (tinApproved && cacApproved) ? 'APPROVED' : 'PENDING';
      const progress = (tinApproved && cacApproved) ? 100 : 50;

      await prisma.verificationStatus.upsert({
        where: { userId },
        update: {
          overallStatus,
          kycStatus: overallStatus,
          progress,
          updatedAt: new Date(),
          reviewedBy: adminId,
          notes: reviewNotes
        },
        create: {
          userId,
          overallStatus,
          kycStatus: overallStatus,
          selfieStatus: 'PENDING',
          progress,
          reviewedBy: adminId,
          notes: reviewNotes
        }
      });

      // Update user account status if fully approved
      if (overallStatus === 'APPROVED') {
        await prisma.user.update({
          where: { id: userId },
          data: { accountStatus: 'ACTIVE' }
        });
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: `BUSINESS_VALIDATION_${action.toUpperCase()}`,
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          adminId,
          adminName: `${admin.firstName} ${admin.lastName}`,
          action,
          tinApproved,
          cacApproved,
          reviewNotes
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `Business validation ${action}d successfully`,
      action,
      tinApproved,
      cacApproved
    });

  } catch (error: any) {
    console.error('POST_BUSINESS_VALIDATION_ERROR', error);

    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred while processing business validation',
      }),
      { status: 500 }
    );
  }
} 