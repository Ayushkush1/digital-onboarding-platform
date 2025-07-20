// lib/business-validation-service.ts
import dojahService from './dojah-service';
import { CacCompanyType } from './dojah-service';
import { prisma } from './prisma';

export interface ValidationResult {
  isValid: boolean;
  status: 'SUCCESS' | 'FAILED' | 'ERROR' | 'PENDING';
  data?: any;
  error?: string;
  timestamp: Date;
  apiResponse?: any;
  validationId?: string; // Database ID for the validation record
}

export interface BusinessValidationResult {
  tinValidation: ValidationResult;
  cacValidation: ValidationResult;
  overallStatus: 'APPROVED' | 'PENDING' | 'FAILED' | 'REQUIRES_MANUAL_REVIEW';
  validationScore: number;
  requiresManualReview: boolean;
  manualReviewReason?: string;
  validationId?: string; // Database ID for the business validation record
}

export interface ValidationRequest {
  userId: string;
  tin?: string;
  rcNumber?: string;
  companyType?: CacCompanyType;
  businessName?: string;
  businessAddress?: string;
  taxNumber?: string;
  additionalData?: any; // Any additional business data
  files?: {
    tinDocument?: File;
    cacDocument?: File;
    businessRegistration?: File;
    taxCertificate?: File;
  };
}

export class BusinessValidationService {
  /**
   * Validate TIN (Tax Identification Number) using Dojah API and store in database
   */
  static async validateTIN(tin: string, userId: string, additionalData?: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: false,
      status: 'PENDING',
      timestamp: new Date()
    };

    try {
      console.log(`Starting TIN validation for: ${tin}, user: ${userId}`);
      
      // Store initial validation attempt in database
      const validationRecord = await prisma.dojahVerification.create({
        data: {
          userId,
          verificationType: 'TIN_VALIDATION' as any,
          requestData: {
            tin,
            timestamp: new Date().toISOString(),
            additionalData
          },
          responseData: { status: 'PENDING' },
          status: 'PENDING'
        }
      });

      result.validationId = validationRecord.id;
      
      const tinResult = await dojahService.lookupFirsTin(tin);
      
      if (tinResult) {
        result.isValid = true;
        result.status = 'SUCCESS';
        result.data = tinResult;
        result.apiResponse = tinResult;
        
        // Update database with success result
        await prisma.dojahVerification.update({
          where: { id: validationRecord.id },
          data: {
            responseData: tinResult as any,
            status: 'SUCCESS',
            confidence: 100,
            extractedData: tinResult as any
          }
        });
        
        console.log(`TIN validation successful for: ${tin}`);
      } else {
        result.status = 'FAILED';
        result.error = 'No result found for provided TIN';
        result.apiResponse = { error: 'No result found' };
        
        // Update database with failure result
        await prisma.dojahVerification.update({
          where: { id: validationRecord.id },
          data: {
            responseData: { error: 'No result found for provided TIN' },
            status: 'FAILED',
            errorMessage: 'No result found for provided TIN'
          }
        });
        
        console.log(`TIN validation failed - no result found for: ${tin}`);
      }
    } catch (error: any) {
      result.status = 'ERROR';
      result.error = error.message || 'TIN validation failed';
      result.apiResponse = { error: error.message, stack: error.stack };
      
      // Update database with error result
      if (result.validationId) {
        await prisma.dojahVerification.update({
          where: { id: result.validationId },
          data: {
            responseData: { error: error.message, stack: error.stack },
            status: 'FAILED',
            errorMessage: error.message
          }
        });
      }
      
      console.error(`TIN validation error for ${tin}:`, error);
    }

    return result;
  }

  /**
   * Validate CAC (Corporate Affairs Commission) RC Number using Dojah API and store in database
   */
  static async validateCAC(rcNumber: string, companyType: CacCompanyType, userId: string, additionalData?: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: false,
      status: 'PENDING',
      timestamp: new Date()
    };

    try {
      console.log(`Starting CAC validation for: ${rcNumber}, type: ${companyType}, user: ${userId}`);
      
      // Store initial validation attempt in database
      const validationRecord = await prisma.dojahVerification.create({
        data: {
          userId,
          verificationType: 'CAC_VALIDATION' as any,
          requestData: {
            rcNumber,
            companyType,
            timestamp: new Date().toISOString(),
            additionalData
          },
          responseData: { status: 'PENDING' },
          status: 'PENDING'
        }
      });

      result.validationId = validationRecord.id;
      
      const cacResult = await dojahService.lookupCacBasic(rcNumber, companyType);
      
      if (cacResult && !('error' in cacResult)) {
        result.isValid = true;
        result.status = 'SUCCESS';
        result.data = cacResult;
        result.apiResponse = cacResult;
        
        // Update database with success result
        await prisma.dojahVerification.update({
          where: { id: validationRecord.id },
          data: {
            responseData: cacResult as any,
            status: 'SUCCESS',
            confidence: 100,
            extractedData: cacResult as any
          }
        });
        
        console.log(`CAC validation successful for: ${rcNumber}`);
      } else {
        result.status = 'FAILED';
        result.error = 'error' in cacResult ? cacResult.error : 'No result found for provided RC number and company type';
        result.apiResponse = cacResult;
        
        // Update database with failure result
        await prisma.dojahVerification.update({
          where: { id: validationRecord.id },
          data: {
            responseData: cacResult as any,
            status: 'FAILED',
            errorMessage: result.error
          }
        });
        
        console.log(`CAC validation failed for: ${rcNumber}`);
      }
    } catch (error: any) {
      result.status = 'ERROR';
      result.error = error.message || 'CAC validation failed';
      result.apiResponse = { error: error.message, stack: error.stack };
      
      // Update database with error result
      if (result.validationId) {
        await prisma.dojahVerification.update({
          where: { id: result.validationId },
          data: {
            responseData: { error: error.message, stack: error.stack },
            status: 'FAILED',
            errorMessage: error.message
          }
        });
      }
      
      console.error(`CAC validation error for ${rcNumber}:`, error);
    }

    return result;
  }

  /**
   * Store business validation data in database
   */
  static async storeBusinessValidationData(
    userId: string,
    validationResult: BusinessValidationResult,
    requestData: ValidationRequest
  ): Promise<string> {
    try {
      // Create or update KYC form data with validation results
      const kycFormData = await prisma.kYCFormData.upsert({
        where: { userId },
        update: {
          tinValidationResult: validationResult.tinValidation as any,
          cacValidationResult: validationResult.cacValidation as any,
          rcNumber: requestData.rcNumber,
          companyType: requestData.companyType,
          businessName: requestData.businessName,
          businessAddress: requestData.businessAddress,
          taxNumber: requestData.taxNumber,
          extractedData: {
            ...requestData.additionalData,
            validationTimestamp: new Date().toISOString(),
            validationScore: validationResult.validationScore,
            overallStatus: validationResult.overallStatus,
            requiresManualReview: validationResult.requiresManualReview,
            manualReviewReason: validationResult.manualReviewReason
          },
          updatedAt: new Date()
        },
        create: {
          userId,
          accountType: 'ENTERPRISE',
          tinValidationResult: validationResult.tinValidation as any,
          cacValidationResult: validationResult.cacValidation as any,
          rcNumber: requestData.rcNumber,
          companyType: requestData.companyType,
          businessName: requestData.businessName,
          businessAddress: requestData.businessAddress,
          taxNumber: requestData.taxNumber,
          extractedData: {
            ...requestData.additionalData,
            validationTimestamp: new Date().toISOString(),
            validationScore: validationResult.validationScore,
            overallStatus: validationResult.overallStatus,
            requiresManualReview: validationResult.requiresManualReview,
            manualReviewReason: validationResult.manualReviewReason
          }
        }
      });

      // Create audit log for business validation
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'BUSINESS_VALIDATION_STORED',
          details: JSON.stringify({
            timestamp: new Date().toISOString(),
            kycFormDataId: kycFormData.id,
            overallStatus: validationResult.overallStatus,
            validationScore: validationResult.validationScore,
            requiresManualReview: validationResult.requiresManualReview,
            tinValidationId: validationResult.tinValidation.validationId,
            cacValidationId: validationResult.cacValidation.validationId
          })
        }
      });

      return kycFormData.id;
    } catch (error) {
      console.error('Error storing business validation data:', error);
      throw error;
    }
  }

  /**
   * Store uploaded files in database
   */
  static async storeValidationFiles(
    userId: string,
    files: ValidationRequest['files'],
    validationType: 'TIN' | 'CAC' | 'BUSINESS'
  ): Promise<string[]> {
    const storedFileIds: string[] = [];

    if (!files) return storedFileIds;

    try {
      for (const [fileType, file] of Object.entries(files)) {
        if (file) {
          // Store file metadata in database
          const fileRecord = await prisma.kYCDocument.create({
            data: {
              userId,
              type: fileType.toUpperCase() as any,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              fileUrl: '', // Will be updated after S3 upload
              s3Key: '', // Will be updated after S3 upload
              status: 'PENDING',
              notes: `Uploaded for ${validationType} validation`
            }
          });

          storedFileIds.push(fileRecord.id);
        }
      }

      // Create audit log for file uploads
      if (storedFileIds.length > 0) {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'VALIDATION_FILES_UPLOADED',
            details: JSON.stringify({
              timestamp: new Date().toISOString(),
              fileIds: storedFileIds,
              validationType,
              fileCount: storedFileIds.length
            })
          }
        });
      }

      return storedFileIds;
    } catch (error) {
      console.error('Error storing validation files:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive business validation including TIN and CAC with full database storage
   */
  static async validateBusinessWithStorage(request: ValidationRequest): Promise<BusinessValidationResult> {
    const result: BusinessValidationResult = {
      tinValidation: {
        isValid: false,
        status: 'PENDING',
        timestamp: new Date()
      },
      cacValidation: {
        isValid: false,
        status: 'PENDING',
        timestamp: new Date()
      },
      overallStatus: 'PENDING',
      validationScore: 0,
      requiresManualReview: false
    };

    try {
      // Store uploaded files first
      const fileIds = await this.storeValidationFiles(request.userId, request.files, 'BUSINESS');

      // Validate TIN if provided
      if (request.tin) {
        result.tinValidation = await this.validateTIN(request.tin, request.userId, {
          businessName: request.businessName,
          businessAddress: request.businessAddress,
          fileIds
        });
      } else {
        result.tinValidation = {
          isValid: false,
          status: 'PENDING',
          timestamp: new Date(),
          error: 'TIN not provided'
        };
      }

      // Validate CAC if both RC number and company type are provided
      if (request.rcNumber && request.companyType) {
        result.cacValidation = await this.validateCAC(
          request.rcNumber, 
          request.companyType, 
          request.userId,
          {
            businessName: request.businessName,
            businessAddress: request.businessAddress,
            fileIds
          }
        );
      } else {
        result.cacValidation = {
          isValid: false,
          status: 'PENDING',
          timestamp: new Date(),
          error: 'RC number or company type not provided'
        };
      }

      // Calculate validation score and overall status
      const validations = [result.tinValidation, result.cacValidation];
      const successfulValidations = validations.filter(v => v.status === 'SUCCESS' && v.isValid);
      const failedValidations = validations.filter(v => v.status === 'FAILED');
      const errorValidations = validations.filter(v => v.status === 'ERROR');

      result.validationScore = validations.length > 0 ? (successfulValidations.length / validations.length) * 100 : 0;

      // Determine overall status and manual review requirements
      if (successfulValidations.length === validations.length) {
        result.overallStatus = 'APPROVED';
      } else if (errorValidations.length > 0) {
        result.overallStatus = 'REQUIRES_MANUAL_REVIEW';
        result.requiresManualReview = true;
        result.manualReviewReason = `API validation errors detected. TIN: ${result.tinValidation.status}, CAC: ${result.cacValidation.status}`;
      } else if (failedValidations.length > 0) {
        result.overallStatus = 'REQUIRES_MANUAL_REVIEW';
        result.requiresManualReview = true;
        result.manualReviewReason = `Validation failed for some fields. TIN: ${result.tinValidation.status}, CAC: ${result.cacValidation.status}`;
      } else {
        result.overallStatus = 'PENDING';
      }

      // Store all validation data in database
      const kycFormDataId = await this.storeBusinessValidationData(request.userId, result, request);
      result.validationId = kycFormDataId;

      console.log(`Business validation completed. Score: ${result.validationScore}%, Status: ${result.overallStatus}, KYC Form ID: ${kycFormDataId}`);
      
    } catch (error) {
      console.error('Error in comprehensive business validation:', error);
      
      // Even if storage fails, return the validation results
      result.overallStatus = 'REQUIRES_MANUAL_REVIEW';
      result.requiresManualReview = true;
      result.manualReviewReason = `Storage error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return result;
  }

  /**
   * Get validation status for display purposes
   */
  static getValidationStatusDisplay(validation: ValidationResult): string {
    switch (validation.status) {
      case 'SUCCESS':
        return validation.isValid ? 'Validated' : 'Invalid';
      case 'FAILED':
        return 'Not Found';
      case 'ERROR':
        return 'API Error';
      case 'PENDING':
        return 'Pending';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get validation status color for UI
   */
  static getValidationStatusColor(validation: ValidationResult): string {
    switch (validation.status) {
      case 'SUCCESS':
        return validation.isValid ? 'green' : 'red';
      case 'FAILED':
        return 'yellow';
      case 'ERROR':
        return 'orange';
      case 'PENDING':
        return 'gray';
      default:
        return 'gray';
    }
  }

  /**
   * Retrieve validation history for a user
   */
  static async getValidationHistory(userId: string): Promise<any[]> {
    try {
      const validations = await prisma.dojahVerification.findMany({
        where: {
          userId,
          verificationType: {
            in: ['TIN_VALIDATION' as any, 'CAC_VALIDATION' as any]
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      return validations;
    } catch (error) {
      console.error('Error retrieving validation history:', error);
      throw error;
    }
  }
} 