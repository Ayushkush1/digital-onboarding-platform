import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { BusinessValidationService, ValidationRequest } from '@/lib/business-validation-service';
import { CacCompanyType } from '@/lib/dojah-service';

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
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
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
      cacValidationResult,
      // New fields for business validation
      tin,
      performBusinessValidation = false,
      additionalData
    } = body;

    let businessValidationResult = null;
    let verificationStatus = 'PENDING';

    // Perform business validation if requested and business data is provided
    if (performBusinessValidation && (tin || (rcNumber && companyType))) {
      try {
        console.log('Starting business validation for user:', userId);
        
        // Create validation request object
        const validationRequest: ValidationRequest = {
          userId,
          tin,
          rcNumber,
          companyType: companyType as CacCompanyType,
          businessName,
          businessAddress,
          taxNumber,
          additionalData: {
            ...additionalData,
            accountType,
            scumlNumber,
            bvn,
            references,
            extractedData
          }
        };

        businessValidationResult = await BusinessValidationService.validateBusinessWithStorage(validationRequest);

        // Determine verification status based on validation results
        if (businessValidationResult.overallStatus === 'APPROVED') {
          verificationStatus = 'APPROVED';
        } else if (businessValidationResult.overallStatus === 'REQUIRES_MANUAL_REVIEW') {
          verificationStatus = 'PENDING'; // Will be reviewed by admin
        } else {
          verificationStatus = 'PENDING';
        }

        console.log('Business validation completed:', {
          userId,
          overallStatus: businessValidationResult.overallStatus,
          validationScore: businessValidationResult.validationScore,
          requiresManualReview: businessValidationResult.requiresManualReview
        });

      } catch (error) {
        console.error('Business validation error:', error);
        // Even if validation fails, we still save the data for manual review
        businessValidationResult = {
          tinValidation: {
            isValid: false,
            status: 'ERROR',
            error: 'Validation service error',
            timestamp: new Date()
          },
          cacValidation: {
            isValid: false,
            status: 'ERROR',
            error: 'Validation service error',
            timestamp: new Date()
          },
          overallStatus: 'REQUIRES_MANUAL_REVIEW',
          validationScore: 0,
          requiresManualReview: true,
          manualReviewReason: 'Business validation service error occurred'
        };
        verificationStatus = 'PENDING';
      }
    }

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
        tinValidationResult: businessValidationResult ? businessValidationResult.tinValidation as any : (tinValidationResult ? tinValidationResult as any : null),
        cacValidationResult: businessValidationResult ? businessValidationResult.cacValidation as any : (cacValidationResult ? cacValidationResult as any : null)
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
        tinValidationResult: businessValidationResult ? businessValidationResult.tinValidation as any : (tinValidationResult ? tinValidationResult as any : null),
        cacValidationResult: businessValidationResult ? businessValidationResult.cacValidation as any : (cacValidationResult ? cacValidationResult as any : null)
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

    // Update verification status based on validation results
    if (isSubmitted) {
      let overallStatus = 'PENDING';
      let kycStatus = 'PENDING';
      let progress = 0;

      // Determine status based on validation results
      if (businessValidationResult) {
        if (businessValidationResult.overallStatus === 'APPROVED') {
          overallStatus = 'APPROVED';
          kycStatus = 'APPROVED';
          progress = 100;
        } else if (businessValidationResult.overallStatus === 'REQUIRES_MANUAL_REVIEW') {
          overallStatus = 'PENDING';
          kycStatus = 'PENDING';
          progress = 50; // Partial progress for manual review
        }
      } else if (scumlNumber && ['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(accountType)) {
        // Fallback to SCUML verification if no business validation
        overallStatus = 'APPROVED';
        kycStatus = 'APPROVED';
        progress = 100;
      }

      await prisma.verificationStatus.upsert({
        where: { userId },
        update: {
          overallStatus,
          kycStatus,
          progress,
          updatedAt: new Date()
        },
        create: {
          userId,
          overallStatus,
          kycStatus,
          selfieStatus: 'PENDING',
          progress
        }
      });

      // Update user account status
      if (overallStatus === 'APPROVED') {
        await prisma.user.update({
          where: { id: userId },
          data: { accountStatus: 'ACTIVE' }
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: kycFormData,
      businessValidation: businessValidationResult,
      verificationStatus
    });
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