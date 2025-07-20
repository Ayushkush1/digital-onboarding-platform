// app/api/user/business-validation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { BusinessValidationService, ValidationRequest } from '@/lib/business-validation-service';
import { CacCompanyType } from '@/lib/dojah-service';
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
      tin, 
      rcNumber, 
      companyType, 
      businessName,
      businessAddress,
      taxNumber,
      additionalData,
      saveToDatabase = true 
    } = body;

    // Validate required parameters
    if (!tin && (!rcNumber || !companyType)) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Missing required parameters. Please provide either TIN or both RC number and company type.' 
        }),
        { status: 400 }
      );
    }

    console.log('Starting business validation for user:', userId, {
      hasTin: !!tin,
      hasRcNumber: !!rcNumber,
      companyType,
      businessName,
      businessAddress
    });

    // Create validation request object
    const validationRequest: ValidationRequest = {
      userId,
      tin,
      rcNumber,
      companyType: companyType as CacCompanyType,
      businessName,
      businessAddress,
      taxNumber,
      additionalData
    };

    // Perform comprehensive business validation with full database storage
    const validationResult = await BusinessValidationService.validateBusinessWithStorage(validationRequest);

    return NextResponse.json({
      success: true,
      validation: validationResult,
      message: validationResult.requiresManualReview 
        ? 'Validation completed but requires manual review by admin'
        : validationResult.overallStatus === 'APPROVED'
        ? 'Validation successful'
        : 'Validation failed'
    });

  } catch (error: any) {
    console.error('BUSINESS_VALIDATION_ERROR', error);

    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred during business validation',
        validation: {
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
        }
      }),
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();

    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    // Get validation results from database
    const kycFormData = await prisma.kYCFormData.findUnique({
      where: { userId },
      select: {
        tinValidationResult: true,
        cacValidationResult: true,
        rcNumber: true,
        companyType: true,
        businessName: true,
        businessAddress: true,
        taxNumber: true,
        updatedAt: true
      }
    });

    if (!kycFormData) {
      return NextResponse.json({ 
        message: 'No business validation data found',
        validation: null 
      });
    }

    // Format the response
    const validation = {
      tinValidation: kycFormData.tinValidationResult,
      cacValidation: kycFormData.cacValidationResult,
      overallStatus: 'PENDING',
      validationScore: 0,
      requiresManualReview: false,
      lastUpdated: kycFormData.updatedAt
    };

    // Calculate overall status if validation data exists
    if (kycFormData.tinValidationResult || kycFormData.cacValidationResult) {
      const validations = [
        kycFormData.tinValidationResult,
        kycFormData.cacValidationResult
      ].filter(Boolean);

      const successfulValidations = validations.filter((v: any) => 
        v.status === 'SUCCESS' && v.isValid
      );
      const errorValidations = validations.filter((v: any) => 
        v.status === 'ERROR'
      );

      validation.validationScore = validations.length > 0 
        ? (successfulValidations.length / validations.length) * 100 
        : 0;

      if (successfulValidations.length === validations.length) {
        validation.overallStatus = 'APPROVED';
      } else if (errorValidations.length > 0) {
        validation.overallStatus = 'REQUIRES_MANUAL_REVIEW';
        validation.requiresManualReview = true;
      }
    }

    // Get validation history
    const validationHistory = await BusinessValidationService.getValidationHistory(userId);

    return NextResponse.json({
      success: true,
      validation,
      businessInfo: {
        rcNumber: kycFormData.rcNumber,
        companyType: kycFormData.companyType,
        businessName: kycFormData.businessName,
        businessAddress: kycFormData.businessAddress,
        taxNumber: kycFormData.taxNumber
      },
      validationHistory
    });

  } catch (error: any) {
    console.error('GET_BUSINESS_VALIDATION_ERROR', error);

    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred while fetching business validation data',
      }),
      { status: 500 }
    );
  }
} 