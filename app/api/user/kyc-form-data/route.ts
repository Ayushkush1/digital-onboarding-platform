import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

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

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      accountType = 'INDIVIDUAL',
      businessName,
      businessAddress,
      taxNumber,
      scumlNumber,
      bvn,
      references,
      extractedData,
      isSubmitted = false,
      rcNumber,
      companyType,
      tinValidationResult,
      cacValidationResult
    } = body;

    // Save or update KYC form data
    const kycFormData = await prisma.kYCFormData.upsert({
      where: {
        userId
      },
      update: {
        accountType,
        businessName,
        businessAddress,
        taxNumber,
        scumlNumber,
        bvn,
        ref1Name: references?.ref1Name,
        ref1Address: references?.ref1Address,
        ref1Phone: references?.ref1Phone,
        ref2Name: references?.ref2Name,
        ref2Address: references?.ref2Address,
        ref2Phone: references?.ref2Phone,
        extractedData,
        isSubmitted,
        submittedAt: isSubmitted ? new Date() : undefined,
        updatedAt: new Date(),
        rcNumber,
        companyType,
        tinValidationResult: tinValidationResult ? tinValidationResult as any : null,
        cacValidationResult: cacValidationResult ? cacValidationResult as any : null
      },
      create: {
        userId,
        accountType,
        businessName,
        businessAddress,
        taxNumber,
        scumlNumber,
        bvn,
        ref1Name: references?.ref1Name,
        ref1Address: references?.ref1Address,
        ref1Phone: references?.ref1Phone,
        ref2Name: references?.ref2Name,
        ref2Address: references?.ref2Address,
        ref2Phone: references?.ref2Phone,
        extractedData,
        isSubmitted,
        submittedAt: isSubmitted ? new Date() : undefined,
        rcNumber,
        companyType,
        tinValidationResult: tinValidationResult ? tinValidationResult as any : null,
        cacValidationResult: cacValidationResult ? cacValidationResult as any : null
      }
    });

    // Also update the user's account table with business information
    if (accountType !== 'INDIVIDUAL') {
      await prisma.account.upsert({
        where: {
          userId
        },
        update: {
          businessName,
          businessAddress,
          taxNumber,
          scumlNumber, // This is the key field for SCUML verification
        },
        create: {
          userId,
          businessName,
          businessAddress,
          taxNumber,
          scumlNumber, // This is the key field for SCUML verification
        }
      });

      // Also update the user's account type
      await prisma.user.update({
        where: { id: userId },
        data: { accountType }
      });
    }

    // If SCUML number is provided and form is submitted, update verification status to verified
    if (scumlNumber && isSubmitted && ['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(accountType)) {
      await prisma.verificationStatus.upsert({
        where: { userId },
        update: {
          overallStatus: 'APPROVED',
          kycStatus: 'APPROVED',
          progress: 100,
          updatedAt: new Date()
        },
        create: {
          userId,
          overallStatus: 'APPROVED',
          kycStatus: 'APPROVED',
          selfieStatus: 'PENDING',
          progress: 100
        }
      });

      // Also update user account status
      await prisma.user.update({
        where: { id: userId },
        data: { accountStatus: 'ACTIVE' }
      });
    }

    return NextResponse.json({ success: true, data: kycFormData });
  } catch (error) {
    console.error('Error saving KYC form data:', error);
    return NextResponse.json(
      { error: 'Failed to save form data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get KYC form data for the user
    const kycFormData = await prisma.kYCFormData.findUnique({
      where: {
        userId
      }
    });

    if (!kycFormData) {
      return NextResponse.json({ data: null });
    }

    // Update last checked timestamp
    await prisma.kYCFormData.update({
      where: {
        userId
      },
      data: {
        lastCheckedAt: new Date()
      }
    });

    return NextResponse.json({ data: kycFormData });
  } catch (error) {
    console.error('Error retrieving KYC form data:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve form data' },
      { status: 500 }
    );
  }
} 