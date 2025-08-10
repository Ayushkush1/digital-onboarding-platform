// lib/dojah-service.ts
import { prisma } from './prisma';
import { DojahVerificationType, DojahStatus, VerificationStatusEnum } from '@/app/generated/prisma';

// Define authentication modes for different API endpoints
enum DojahAuthMode {
  PUBLIC_KEY = 'PUBLIC_KEY',  // For Fraud Detection APIs
  SECRET_KEY = 'SECRET_KEY'   // For KYC, Document Analysis, etc.
}

interface DojahConfig {
  appId: string;
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
}

interface DojahResponse {
  entity?: any;
  error?: string;
  status_code?: number;
  message?: string;
}

// Constants for API request handling
const MAX_RETRY_ATTEMPTS = 2;
const API_TIMEOUT = 15000; // 15 seconds timeout

interface DocumentAnalysisResult {
  extractedText?: string;
  extractedData?: any;
  documentType?: {
    documentName?: string;
    documentCountryName?: string;
    documentCountryCode?: string;
  };
  confidence?: number;
  isReadable: boolean;
  qualityScore?: number;
  isValid: boolean;
  validationStatus: {
    overallStatus: number;
    reason: string;
    documentImages: string;
    text: string;
    documentType: string;
    expiry: string;
  };
  textData?: Array<{
    fieldName: string;
    fieldKey: string;
    status: number;
    value: string;
  }>;
  documentImages?: {
    portrait?: string;
    documentFrontSide?: string;
    documentBackSide?: string;
  };
}

interface GovernmentLookupResult {
  isMatch: boolean;
  matchScore?: number;
  governmentData?: any;
  extractedPersonalInfo?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    dateOfBirth?: string;
    gender?: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
    photo?: string;
  };
}

interface SelfieVerificationResult {
  isMatch: boolean;
  confidence: number;
  livenessScore?: number;
  qualityChecks?: {
    faceDetected: boolean;
    imageQuality: string;
    lighting: string;
  };
}

class DojahService {
  private config: DojahConfig;
  constructor() {
    const environment = (process.env.DOJAH_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';

    let baseUrl = process.env.DOJAH_BASE_URL;
    if (!baseUrl) {
      baseUrl = environment === 'production'
        ? 'https://api.dojah.io'
        : 'https://sandbox.dojah.io';
    }

    this.config = {
      appId: process.env.DOJAH_APP_ID || '',
      publicKey: process.env.DOJAH_PUBLIC_KEY || '',
      secretKey: process.env.DOJAH_SECRET_KEY || '',
      baseUrl,
      environment
    };

    if (!this.config.appId || !this.config.publicKey || !this.config.secretKey) {
      throw new Error('Dojah API credentials not configured');
    }
  }

  /**
   * Helper function to make API calls with retries and timeout
   */
  private async fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRY_ATTEMPTS): Promise<Response> {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error;
        console.log(`Dojah API call attempt ${attempt + 1}/${retries + 1} failed:`, error instanceof Error ? error.message : 'Unknown error');

        // If we've used all retries, or if it's not a timeout error, throw
        if (attempt >= retries || !(error instanceof Error && error.name === 'AbortError')) {
          break;
        }

        // Wait before retrying (exponential backoff: 1s, 2s, 4s, etc.)
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`Waiting ${backoffDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError;
  }
  /**
   * Get the authentication key based on the specified mode
   */
  private getAuthKey(authMode: DojahAuthMode): string {
    return authMode === DojahAuthMode.PUBLIC_KEY
      ? this.config.publicKey
      : this.config.secretKey;
  }

  /**
   * Determine the auth mode based on the API endpoint
   */  private getAuthModeForEndpoint(endpoint: string): DojahAuthMode {
    // IP fraud endpoint is an exception and requires SECRET_KEY
    if (endpoint.includes('/fraud/ip')) {
      console.log(`Using SECRET_KEY auth for IP fraud endpoint: ${endpoint}`);
      return DojahAuthMode.SECRET_KEY;
    }
    // Other fraud detection and credit bureau APIs use PUBLIC_KEY
    else if (endpoint.includes('/fraud/') || endpoint.includes('/credit_bureau')) {
      console.log(`Using PUBLIC_KEY auth for endpoint: ${endpoint}`);
      return DojahAuthMode.PUBLIC_KEY;
    }
    // All other APIs use SECRET_KEY (KYC, document analysis, etc.)
    console.log(`Using SECRET_KEY auth for endpoint: ${endpoint}`);
    return DojahAuthMode.SECRET_KEY;
  }
  private async makeRequest(
    endpoint: string,
    params: Record<string, any> = {},
    authModeOverride?: DojahAuthMode
  ): Promise<DojahResponse> {
    const url = new URL(endpoint, this.config.baseUrl);

    // Determine the authentication mode
    const authMode = authModeOverride || this.getAuthModeForEndpoint(endpoint);
    const authKey = this.getAuthKey(authMode);

    // Add query parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key].toString());
      }
    });

    try {
      console.log(`Making GET request to ${url.toString()} with auth mode: ${authMode}`);
      console.log(`Using AppId: ${this.config.appId}, Auth Key starting with: ${authKey.substring(0, 8)}...`);

      const response = await this.fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
          'AppId': this.config.appId,
          'Authorization': authKey,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error('Dojah API request failed:', error);
      throw error;
    }
  } private async makePostRequest(
    endpoint: string,
    body: any,
    authModeOverride?: DojahAuthMode
  ): Promise<DojahResponse> {
    const url = new URL(endpoint, this.config.baseUrl);

    // Determine the authentication mode
    const authMode = authModeOverride || this.getAuthModeForEndpoint(endpoint);
    const authKey = this.getAuthKey(authMode);

    try {
      console.log(`Making POST request to ${url.toString()} with auth mode: ${authMode}`);
      console.log(`Using AppId: ${this.config.appId}, Auth Key starting with: ${authKey.substring(0, 8)}...`); const response = await this.fetchWithRetry(url.toString(), {
        method: 'POST',
        headers: {
          'AppId': this.config.appId,
          'Authorization': authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // Check if the response is ok before trying to parse JSON
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        } else {
          // Handle non-JSON responses (like HTML error pages)
          const text = await response.text();
          console.error('Non-JSON error response:', text.substring(0, 200)); // Log first 200 chars
          throw new Error(`HTTP ${response.status}: ${response.statusText} (non-JSON response)`);
        }
      }

      // Only try to parse JSON if the response is successful
      let data;
      try {
        data = await response.json();
        console.log('Dojah API POST response:', data);
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        const text = await response.text();
        console.error('Response text:', text.substring(0, 200)); // Log first 200 chars
        throw new Error('Invalid JSON response from API');
      }

      return data;
    } catch (error) {
      console.error('Dojah API POST request failed:', error);
      throw error;
    }
  }
  // BVN Lookup
  async lookupBVN(bvn: string, advanced: boolean = false): Promise<GovernmentLookupResult> {
    const endpoint = advanced ? '/api/v1/kyc/bvn/advance' : '/api/v1/kyc/bvn/full';

    // Always use real BVN regardless of environment
    // Explicitly use SECRET_KEY auth for KYC operations
    const response = await this.makeRequest(endpoint, { bvn }, DojahAuthMode.SECRET_KEY);

    if (!response.entity) {
      return { isMatch: false };
    }

    return {
      isMatch: true,
      matchScore: 100,
      governmentData: response.entity,
      extractedPersonalInfo: {
        firstName: response.entity.first_name,
        lastName: response.entity.last_name,
        middleName: response.entity.middle_name,
        dateOfBirth: response.entity.date_of_birth,
        gender: response.entity.gender,
        phoneNumber: response.entity.phone_number1,
        email: response.entity.email,
        photo: response.entity.image
      }
    };
  }
  // NIN Lookup
  async lookupNIN(nin: string): Promise<GovernmentLookupResult> {
    const endpoint = '/api/v1/kyc/nin';

    // Always use real NIN regardless of environment
    // Explicitly use SECRET_KEY auth for KYC operations
    const response = await this.makeRequest(endpoint, { nin }, DojahAuthMode.SECRET_KEY);

    if (!response.entity) {
      return { isMatch: false };
    }

    return {
      isMatch: true,
      matchScore: 100,
      governmentData: response.entity,
      extractedPersonalInfo: {
        firstName: response.entity.first_name,
        lastName: response.entity.last_name,
        middleName: response.entity.middle_name,
        dateOfBirth: response.entity.date_of_birth,
        gender: response.entity.gender,
        phoneNumber: response.entity.phone_number,
        email: response.entity.email,
        photo: response.entity.photo
      }
    };
  }
  // Passport Lookup
  async lookupPassport(passportNumber: string, surname: string): Promise<GovernmentLookupResult> {
    const endpoint = '/api/v1/kyc/passport';

    // Always use real passport number regardless of environment
    // Explicitly use SECRET_KEY auth for KYC operations
    const response = await this.makeRequest(endpoint, {
      passport_number: passportNumber,
      surname: surname
    }, DojahAuthMode.SECRET_KEY);

    if (!response.entity) {
      return { isMatch: false };
    }

    return {
      isMatch: true,
      matchScore: 100,
      governmentData: response.entity,
      extractedPersonalInfo: {
        firstName: response.entity.first_name,
        lastName: response.entity.surname,
        middleName: response.entity.other_names,
        dateOfBirth: response.entity.date_of_birth,
        gender: response.entity.gender,
        photo: response.entity.photo
      }
    };
  }
  // Driver's License Lookup
  async lookupDriversLicense(licenseNumber: string): Promise<GovernmentLookupResult> {
    const endpoint = '/api/v1/kyc/dl';


    // Always use real license number regardless of environment
    // Explicitly use SECRET_KEY auth for KYC operations
    // const response = await this.makeRequest(endpoint, { license_number: licenseNumber}, DojahAuthMode.SECRET_KEY);

    // if (!response.entity) {
    //   return { isMatch: false };
    // }

    //TODO: Implement the actual API call when available
    return {
      isMatch: true,
      matchScore: 100,
      governmentData: "Dummy",
      extractedPersonalInfo: {
        firstName: "Dummy",
        lastName: "Dummy",
        middleName: "Dummy",
        dateOfBirth: "Dummy",
        gender: "Dummy",
        photo: "Dummy",
      }
    };
  }

  // CAC Lookup (Corporate Affairs Commission)
  async lookupCAC(rcNumber: string): Promise<{
    isValid: boolean;
    entity?: any;
    companyData?: {
      companyName?: string;
      rcNumber?: string;
      registrationDate?: string;
      companyType?: string;
      status?: string;
      address?: string;
      directors?: any[];
      shareholders?: any[];
    };
  }> {
    const endpoint = '/api/v1/kyc/cac/basic';

    try {
      // Use SECRET_KEY auth for KYC operations

      const response = await this.makeRequest(endpoint, { rc_number: rcNumber, 'company_type': 'COMPANY' }, DojahAuthMode.SECRET_KEY);

      if (!response.entity) {
        return { isValid: false };
      }

      return {
        isValid: true,
        entity: response.entity,
        companyData: {
          companyName: response.entity.company_name,
          rcNumber: response.entity.rc_number,
          registrationDate: response.entity.registration_date,
          companyType: response.entity.company_type,
          status: response.entity.status,
          address: response.entity.address,
          directors: response.entity.directors || [],
          shareholders: response.entity.shareholders || []
        }
      };
    } catch (error: any) {
      console.error('CAC lookup failed:', error);
      // If the API returns 404 or error, validation failed
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        return { isValid: false };
      }
      throw error;
    }
  }
  // Document Analysis
  async analyzeDocument(
    imageFrontSide: string,
    imageBackSide?: string,
    additionalImages?: string[],
    inputType: 'url' | 'base64' = 'base64'
  ): Promise<DocumentAnalysisResult> {
    const endpoint = '/api/v1/document/analysis';

    const requestBody = {
      input_type: inputType,
      imagefrontside: imageFrontSide,
      imagebackside: imageBackSide,
      images: additionalImages
    };

    console.log('Making document analysis request with SECRET_KEY authentication');
    // Always use SECRET_KEY auth for document analysis - explicitly force it
    const response = await this.makePostRequest(endpoint, requestBody, DojahAuthMode.SECRET_KEY);

    console.log('Dojah document analysis response received:',
      response?.entity ? 'Response has entity object' : 'No entity in response');

    if (!response.entity) {
      return {
        isReadable: false,
        confidence: 0,
        isValid: false,
        validationStatus: {
          overallStatus: 0,
          reason: 'NO_RESPONSE',
          documentImages: 'No',
          text: 'No',
          documentType: 'No',
          expiry: 'No'
        }
      };
    }

    return {
      documentType: {
        documentName: response.entity.document_type?.document_name,
        documentCountryName: response.entity.document_type?.document_country_name,
        documentCountryCode: response.entity.document_type?.document_country_code
      },
      isValid: response.entity.status?.overall_status === 1,
      validationStatus: {
        overallStatus: response.entity.status?.overall_status || 0,
        reason: response.entity.status?.reason || 'UNKNOWN',
        documentImages: response.entity.status?.document_images || 'No',
        text: response.entity.status?.text || 'No',
        documentType: response.entity.status?.document_type || 'No',
        expiry: response.entity.status?.expiry || 'No'
      },
      textData: response.entity.text_data?.map((field: any) => ({
        fieldName: field.field_name,
        fieldKey: field.field_key,
        status: field.status,
        value: field.value
      })),
      documentImages: {
        portrait: response.entity.document_images?.portrait,
        documentFrontSide: response.entity.document_images?.document_front_side,
        documentBackSide: response.entity.document_images?.document_back_side
      },
      confidence: response.entity.confidence || 0,
      isReadable: true
    };
  }
  // Selfie Photo ID Match
  async verifySelfieWithPhotoId(selfieBase64: string, idPhotoBase64?: string, userId?: string): Promise<SelfieVerificationResult> {
    // Using the correct endpoint from the documentation
    const endpoint = '/api/v1/kyc/photoid/verify';

    // If idPhotoBase64 is not provided but userId is, try to find a passport document
    if (!idPhotoBase64 && userId) {
      try {
        const passportDocument = await prisma.kYCDocument.findFirst({
          where: {
            userId,
            type: 'PASSPORT', // Specifically look for passport documents
            // Not checking verification status anymore
          }
        });

        if (passportDocument) {
          // Get base64 from S3
          idPhotoBase64 = await this.getBase64FromS3OrFallback(passportDocument);
          console.log(`Retrieved passport document for user ${userId}`);
        } else {
          // Throw an error if no passport document is found
          throw new Error('Passport document is required for selfie verification but no passport was found for this user');
        }
      } catch (error) {
        console.error('Error with passport document:', error);
        throw error; // Re-throw the error to be handled by the caller
      }
    }

    // Verify idPhotoBase64 is available
    if (!idPhotoBase64) {
      const error = 'No ID photo provided and none could be retrieved from database';
      console.error(error);
      throw new Error(error);
    }

    // Process base64 strings to ensure they don't include data:image prefixes
    const processedSelfieBase64 = selfieBase64.includes('base64,')
      ? selfieBase64.split('base64,')[1]
      : selfieBase64;

    const processedIdPhotoBase64 = idPhotoBase64.includes('base64,')
      ? idPhotoBase64.split('base64,')[1]
      : idPhotoBase64;

    // Using the correct parameter names from the documentation
    // Explicitly use SECRET_KEY auth for KYC operations
    const response = await this.makePostRequest(endpoint, {
      selfie_image: processedSelfieBase64,
      photoid_image: processedIdPhotoBase64  // Note: No underscore between 'photo' and 'id'
    }, DojahAuthMode.SECRET_KEY);

    // Log the full response for debugging
    console.log('Selfie verification full response:', JSON.stringify(response));

    // Handle potential different response formats
    if (!response.entity) {
      console.error('Unexpected response format:', response);
      return {
        isMatch: false,
        confidence: 0
      };
    }

    // Use entity from the response structure
    const responseData = response.entity || {};

    return {
      isMatch: responseData.face_match || false,
      confidence: responseData.confidence || 0,
      livenessScore: responseData.liveness_score,
      qualityChecks: {
        faceDetected: responseData.face_detected || false,
        imageQuality: responseData.image_quality || 'unknown',
        lighting: responseData.lighting || 'unknown'
      }
    };
  }
  // Liveness Check
  async checkLiveness(imageBase64: string): Promise<{
    isLive: boolean;
    livenessProbability: number;
    faceDetected: boolean;
    multiFaceDetected: boolean;
    faceDetails: any;
    faceQuality: any;
  }> {
    const endpoint = '/api/v1/ml/liveness/';

    // Make sure the imageBase64 doesn't start with data:image prefix
    const base64Data = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    // Explicitly use SECRET_KEY auth for liveness check
    const response = await this.makePostRequest(endpoint, {
      image: base64Data
    }, DojahAuthMode.SECRET_KEY);

    console.log('Liveness check response:', JSON.stringify(response));

    if (!response.entity) {
      return {
        isLive: false,
        livenessProbability: 0,
        faceDetected: false,
        multiFaceDetected: false,
        faceDetails: null,
        faceQuality: null
      };
    }

    // The API documentation indicates that liveness_probability > 50 means the face is live
    const livenessProbability = response.entity.liveness?.liveness_probability || 0;

    return {
      isLive: livenessProbability > 50, // Consider live if probability is above 50%
      livenessProbability,
      faceDetected: response.entity.face?.face_detected || false,
      multiFaceDetected: response.entity.face?.multiface_detected || false,
      faceDetails: response.entity.face?.details || null,
      faceQuality: response.entity.face?.quality || null
    };
  }
  // AML Screening
  async performAMLScreening(personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    nationality?: string;
  }): Promise<any> {
    const endpoint = '/api/v1/aml/individual';

    // Explicitly use SECRET_KEY auth for AML screening
    const response = await this.makePostRequest(endpoint, {
      first_name: personalInfo.firstName,
      last_name: personalInfo.lastName,
      date_of_birth: personalInfo.dateOfBirth,
      nationality: personalInfo.nationality || 'NG'
    }, DojahAuthMode.SECRET_KEY);

    return response.entity || {};
  }

  // Comprehensive Document Verification
  async verifyDocument(accountType: string, userId: string, documentId: string, documentBase64?: string | null, documentType?: string): Promise<{ verificationId: string, documentTypeMismatchNote?: string }> {
    console.log(`Starting document verification for user: ${userId}, document: ${documentId}`);
    try {
      // Get document from database if not provided
      let document;
      if (!documentBase64 || !documentType) {
        document = await prisma.kYCDocument.findUnique({
          where: { id: documentId }
        });

        if (!document) {
          throw new Error(`Document with ID ${documentId} not found`);
        }

        // Get document type if not provided
        if (!documentType) {
          documentType = document.type.toString();
        }

        // Get base64 if not provided
        if (!documentBase64) {
          const base64Content = await this.getBase64FromS3OrFallback(document);

          if (!base64Content) {
            throw new Error('Could not retrieve document content');
          }

          documentBase64 = base64Content;
        }
      }

      // Create initial verification record
      const verification = await prisma.dojahVerification.create({
        data: {
          userId,
          verificationType: DojahVerificationType.DOCUMENT_ANALYSIS,
          documentId,
          status: DojahStatus.IN_PROGRESS,
          requestData: { documentType }
        }
      });

      // Check if this is a passport or utility bill - these types need special handling
      const isPassport = documentType === 'PASSPORT';
      const isUtilityBill = documentType === 'UTILITY_BILL';
      const needsBypass = isPassport || isUtilityBill;

      if (needsBypass) {
        console.log(`Document type ${documentType} detected - applying special validation handling`);
      }

      // Step 1: Analyze document
      let analysisResult = await this.analyzeDocument(documentBase64);

      console.log('-------------------------------------------------------');
      console.log(`Document analysis completed for document ID: ${documentId}`);
      console.log('Dojah document analysis result:', analysisResult);

      // // Apply bypass for passport and utility bill documents that often fail Dojah validation
      // if (needsBypass) {
      //   console.log(`Applying validation bypass for ${documentType} document ${documentId}`);
      //   // Override the validation status to valid if there's at least some data extracted
      //   // or if the document was uploaded (ensure basic validation only)
      //   if (analysisResult && document) {
      //     // Force the document to be valid even if Dojah marked it invalid
      //     analysisResult.isValid = true;
      //     analysisResult.validationStatus = {
      //       ...analysisResult.validationStatus,
      //       overallStatus: 1, // Force status to valid (1)
      //       reason: `MANUAL_BYPASS_APPLIED_FOR_${documentType}`,
      //     };
      //     console.log(`Validation bypass applied successfully for ${documentType} document`);
      //   }
      // }

      // First, check if a document analysis already exists for this document
      const existingAnalysis = await prisma.documentAnalysis.findUnique({
        where: { kycDocumentId: documentId }
      });

      if (existingAnalysis) {
        console.log(`Found existing document analysis for document ID: ${documentId}, will update it`);
      } else {
        console.log(`No existing document analysis found for document ID: ${documentId}, will create new one`);
      }

      // Store document analysis - use upsert to handle existing records
      try {
        await prisma.documentAnalysis.upsert({
          where: {
            kycDocumentId: documentId
          },
          update: {
            extractedText: analysisResult.extractedText,
            extractedData: analysisResult.extractedData as any,
            documentType: analysisResult.documentType as any,
            confidence: analysisResult.confidence,
            isReadable: analysisResult.isReadable,
            qualityScore: analysisResult.qualityScore,
            analysisProvider: 'DOJAH',
            isValid: analysisResult.isValid,
            validationStatus: analysisResult.validationStatus as any,
            textData: analysisResult.textData as any,
            documentImages: analysisResult.documentImages as any
          },
          create: {
            kycDocumentId: documentId,
            extractedText: analysisResult.extractedText,
            extractedData: analysisResult.extractedData as any,
            documentType: analysisResult.documentType as any,
            confidence: analysisResult.confidence,
            isReadable: analysisResult.isReadable,
            qualityScore: analysisResult.qualityScore,
            analysisProvider: 'DOJAH',
            isValid: analysisResult.isValid,
            validationStatus: analysisResult.validationStatus as any,
            textData: analysisResult.textData as any,
            documentImages: analysisResult.documentImages as any
          }
        });
        console.log(`Successfully saved document analysis for document ID: ${documentId}`);
      } catch (error) {
        console.error(`Error saving document analysis for document ID: ${documentId}:`, error);
        // Don't throw, let's continue with the process
      }


      // Step 2: Government lookup if we have extracted data
      //TODO: Handle cases where documentType is not provided


      let governmentResult: GovernmentLookupResult | null = null; if (analysisResult.documentType?.documentName && analysisResult.textData) {
        const documentNumber = analysisResult.textData.find(field => field.fieldKey === "document_number");
        governmentResult = await this.performGovernmentLookup(
          analysisResult.documentType.documentName,
          documentNumber
        );
      }

      // Update verification with results
      await prisma.dojahVerification.update({
        where: { id: verification.id },
        data: {
          status: DojahStatus.SUCCESS,
          confidence: analysisResult.confidence,
          extractedData: analysisResult.extractedData as any,
          governmentData: governmentResult?.governmentData as any,
          matchResult: governmentResult ? {
            isMatch: governmentResult.isMatch,
            matchScore: governmentResult.matchScore
          } as any : null,
          responseData: {
            documentAnalysis: analysisResult,
            governmentLookup: governmentResult
          } as any
        }
      });

      // Update KYC document status based on validation result
      let documentTypeMismatchNote = '';
      try {

        let documentStatus;
        let isDocumentTypeMatch;

        console.log(`Vishal : ${accountType} - ${documentType}`);
        // Add a if condition to check if AccountType is Individual if its individual then we can check for documentType match else we can skip this check
        // if (accountType === 'individual') { 
        //   if (analysisResult.documentType?.documentName && documentType && analysisResult.isValid) {
        //     isDocumentTypeMatch = this.validateDocumentTypeMatch(documentType, analysisResult.documentType.documentName);
        //     console.log(`Document type match for ${documentType} against ${analysisResult.documentType.documentName}: ${isDocumentTypeMatch}`);
        //     if (!isDocumentTypeMatch) {
        //       documentTypeMismatchNote = `Document type mismatch: Expected ${documentType}, but extracted ${analysisResult.documentType.documentName}`;
        //       documentStatus = VerificationStatusEnum.REQUIRES_REUPLOAD;
        //     }
        //   } else if (!analysisResult.isValid && !isUtilityBill) {
        //     documentTypeMismatchNote = 'Document is invalid';
        //     console.log(`Document is invalid`);
        //     documentStatus = VerificationStatusEnum.REQUIRES_REUPLOAD;
        //   }
        // } else {
        //   // Skip document type match check for non-individual accounts
        //   documentStatus = VerificationStatusEnum.IN_PROGRESS;
        // }
        documentStatus = VerificationStatusEnum.IN_PROGRESS;
        await prisma.kYCDocument.update({
          where: { id: documentId },
          data: {
            verified: analysisResult.isValid,
            status: documentStatus,
            notes: documentTypeMismatchNote ? ` ${documentTypeMismatchNote}` : '',
            verifiedAt: analysisResult.isValid ? new Date() : null
          }
        });

        console.log(`Updated KYC document status to ${documentStatus} for document ID: ${documentId}`);
      } catch (error) {
        console.error(`Failed to update KYC document status for document ID: ${documentId}:`, error);
      }

      return { verificationId: verification.id, documentTypeMismatchNote: documentTypeMismatchNote || undefined };
    } catch (error) {
      console.error('Document verification failed:', error);
      throw error;
    }
  }

  // Comprehensive Selfie Verification
  async verifySelfie(userId: string, selfieId: string, selfieBase64?: string, idDocumentBase64?: string, performLivenessCheck: boolean = true): Promise<string> {
    let verification;

    try {
      // Get selfie from database if not provided
      if (!selfieBase64) {
        const selfie = await prisma.selfieVerification.findUnique({
          where: { id: selfieId }
        });

        if (!selfie) {
          throw new Error(`Selfie with ID ${selfieId} not found`);
        }

        // Get base64 from S3
        const base64Content = await this.getBase64FromS3OrFallback(selfie);

        if (!base64Content) {
          throw new Error('Could not retrieve selfie content');
        }

        selfieBase64 = base64Content;
      }

      // If idDocumentBase64 is not provided but userId is, try to find a passport document
      // We now only look for passport documents and don't check verification status
      if (!idDocumentBase64 && userId) {
        // Look for a passport document without status check
        const passportDocument = await prisma.kYCDocument.findFirst({
          where: {
            userId,
            type: 'PASSPORT', // Only look for passport documents
            // No status verification check
          }
        });

        if (passportDocument) {
          idDocumentBase64 = await this.getBase64FromS3OrFallback(passportDocument);
          console.log(`Retrieved passport document for user ${userId} in verifySelfie`);
        } else {
          // Throw an error if no passport document is found
          throw new Error('Passport document is required for selfie verification but no passport was found for this user');
        }
      }

      // Create initial verification record
      verification = await prisma.dojahVerification.create({
        data: {
          userId,
          verificationType: DojahVerificationType.SELFIE_PHOTO_ID_MATCH,
          documentId: selfieId,
          status: DojahStatus.IN_PROGRESS,
          requestData: { hasIdDocument: !!idDocumentBase64 } as any
        }
      });

      // Step 1: Perform liveness check if required
      let livenessResult = null;
      if (performLivenessCheck) {
        livenessResult = await this.checkLiveness(selfieBase64);

        // Fail verification if no face is detected or multiple faces are detected
        // if (!livenessResult.faceDetected || livenessResult.multiFaceDetected || !livenessResult.isLive) {
        //   let errorMessage = 'Verification failed';

        //   if (!livenessResult.faceDetected) {
        //     errorMessage = 'No face detected in the image';
        //   } else if (livenessResult.multiFaceDetected) {
        //     errorMessage = 'Multiple faces detected in the image';
        //   } else if (!livenessResult.isLive) {
        //     errorMessage = `Liveness check failed. Score: ${livenessResult.livenessProbability.toFixed(2)}% (threshold: 50%)`;
        //   }

        //   await prisma.dojahVerification.update({
        //     where: { id: verification.id },
        //     data: {
        //       status: DojahStatus.FAILED,
        //       responseData: {
        //         livenessCheck: livenessResult,
        //         error: errorMessage
        //       } as any
        //     }
        //   });

        //   return verification.id;
        // }
      }

      // Step 2: Perform actual verification with Dojah API
      // Attempt verification with existing ID document or fetch a passport from user's documents
      let verificationResult;
      try {
        verificationResult = await this.verifySelfieWithPhotoId(selfieBase64, idDocumentBase64, userId);
      } catch (error: any) {
        // Update verification status to FAILED if passport is missing
        await prisma.dojahVerification.update({
          where: { id: verification.id },
          data: {
            status: DojahStatus.FAILED,
            responseData: {
              error: error.message || 'Failed to verify selfie with ID photo'
            } as any
          }
        });

        throw error; // Re-throw the error
      }

      // Update verification with results
      await prisma.dojahVerification.update({
        where: { id: verification.id },
        data: {
          status: DojahStatus.SUCCESS,
          confidence: verificationResult.confidence,
          matchResult: {
            isMatch: verificationResult.isMatch,
            confidence: verificationResult.confidence,
            livenessScore: verificationResult.livenessScore || (livenessResult ? livenessResult.livenessProbability : undefined),
            qualityChecks: verificationResult.qualityChecks
          } as any,
          responseData: {
            selfiePhotoIdMatch: verificationResult,
            livenessCheck: livenessResult
          } as any
        }
      });

      return verification.id;
    } catch (error: any) {
      console.error('Selfie verification failed:', error);

      // Update verification status to FAILED if we have a verification ID
      if (verification?.id) {
        try {
          await prisma.dojahVerification.update({
            where: { id: verification.id },
            data: {
              status: DojahStatus.FAILED,
              responseData: { error: error.message || 'Unknown error' } as any
            }
          });
        } catch (updateError) {
          console.error('Failed to update verification status:', updateError);
        }
      }

      throw error;
    }
  }
  private async performGovernmentLookup(documentType: string, documentNo: any): Promise<GovernmentLookupResult | null> {
    try {
      if (!documentType || !documentNo?.value) {
        console.warn('Missing document type or number for government lookup');
        return null;
      }

      // Normalize document type for comparison
      const normalizedType = documentType.toLowerCase().trim();

      // Determine which government API to use based on document type
      if (normalizedType.includes('bvn')) {
        return await this.lookupBVN(documentNo.value);
      }

      if (normalizedType.includes('nin') || normalizedType.includes('national id')) {
        return await this.lookupNIN(documentNo.value);
      }

      if (normalizedType.includes('passport')) {
        // Note: Surname needs to be extracted from analysisResult.textData for passport lookup
        // For now, just use document number lookup
        //return await this.lookupDriversLicense(documentNo.value);
      }

      if (normalizedType.includes('driver') || normalizedType.includes('license')) {
        return await this.lookupDriversLicense(documentNo.value);
      }

      console.warn('Unrecognized document type:', documentType);
      return null;
    } catch (error) {
      console.error('Government lookup failed:', error);
      return null;
    }
  }

  // Get verification status
  async getVerificationStatus(verificationId: string) {
    return await prisma.dojahVerification.findUnique({
      where: { id: verificationId },
      include: {
        adminReviews: {
          include: {
            reviewer: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
  }

  // Get all verifications for a user
  async getUserVerifications(userId: string) {
    return await prisma.dojahVerification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        adminReviews: {
          include: {
            reviewer: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
  }
  // Helper method to get base64 from S3 or fallback to existing file
  async getBase64FromS3OrFallback(document: any): Promise<string | undefined> {
    try {
      if (document.s3Key) {
        // Get the file content from S3 using our helper function
        const { getFileBase64FromS3 } = await import('./s3-service');
        return await getFileBase64FromS3(document.s3Key);
      }
      // No fallback to legacy methods anymore
      return undefined;
    } catch (error) {
      console.error('Error getting base64 from S3:', error);
      return undefined;
    }
  }
  // FRAUD DETECTION APIS
  // IP Screening  
  async checkIpAddress(ipAddress: string): Promise<any> {
    try {
      const endpoint = '/api/v1/fraud/ip';
      console.log(`IP Address check: ${ipAddress}`);

      // The fraud/ip endpoint actually requires SECRET_KEY despite being a fraud endpoint
      // This is an exception to the rule that fraud endpoints use PUBLIC_KEY
      const response = await this.makeRequest(endpoint, { ip_address: ipAddress }, DojahAuthMode.SECRET_KEY);
      return response;
    } catch (error) {
      console.error('IP check error details:', error);
      throw error;
    }
  }

  // Email Check
  async checkEmail(emailAddress: string): Promise<any> {
    const endpoint = '/api/v1/fraud/email';
    // Explicitly use PUBLIC_KEY auth for fraud detection
    const response = await this.makeRequest(endpoint, { email_address: emailAddress }, DojahAuthMode.PUBLIC_KEY);
    return response;
  }

  // Phone Check
  async checkPhone(phoneNumber: string): Promise<any> {
    const endpoint = '/api/v1/fraud/phone';
    // Explicitly use PUBLIC_KEY auth for fraud detection
    const response = await this.makeRequest(endpoint, { phone_number: phoneNumber }, DojahAuthMode.PUBLIC_KEY);
    return response;
  }

  // Credit Check
  async checkCreditBureau(bvn: string): Promise<any> {
    const endpoint = '/api/v1/credit_bureau';
    // Explicitly use PUBLIC_KEY auth for credit bureau
    const response = await this.makeRequest(endpoint, { bvn }, DojahAuthMode.PUBLIC_KEY);
    return response;
  }
  // Comprehensive fraud check - only IP check and phone check
  async performComprehensiveCheck(userData: {
    userId: string,
    ipAddress?: string,
    emailAddress?: string,
    phoneNumber?: string,
    bvn?: string
  }): Promise<{
    overallRisk: number,
    ipCheck?: any,
    phoneCheck?: any,
    phoneStatus?: string
  }> {
    const results: any = {
      overallRisk: 0,
    };

    let riskFactors = 0;
    let checksPerformed = 0;

    // Run checks in parallel for efficiency
    const checks: Promise<any>[] = []; if (userData.ipAddress) {
      checks.push(this.checkIpAddress(userData.ipAddress)
        .then(result => {
          results.ipCheck = result;
          // Add a default risk score if the API succeeded but didn't return a risk score
          if (result?.entity?.report?.risk_score?.result) {
            results.overallRisk += result.entity.report.risk_score.result;
            riskFactors++;
          } else if (result?.entity) {
            // Add a moderate risk score if we got a response but no risk score
            console.log('IP check successful but no risk score provided, using default risk score');
            results.overallRisk += 30; // Default moderate risk
            riskFactors++;
          }
          checksPerformed++;
        })
        .catch(err => {
          console.error('IP check failed:', err);
          results.ipCheck = { error: err.message };
          // Add a moderate risk score even on failure to avoid blocking the process
          results.overallRisk += 30; // Default moderate risk on failure
          // We still count this as a check performed
          checksPerformed++;
        }));
    }

    if (userData.phoneNumber) {
      checks.push(this.checkPhone(userData.phoneNumber)
        .then(result => {
          results.phoneCheck = result;
          results.phoneStatus = 'COMPLETED';
          if (result?.entity?.score > 0) {
            results.overallRisk += result.entity.score;
            riskFactors++;
          }
          checksPerformed++;
        })
        .catch(err => {
          console.error('Phone check failed:', err);
          results.phoneCheck = { error: err.message };
          results.phoneStatus = 'ERROR';
        }));
    } else {
      // Phone number not provided
      results.phoneStatus = 'NOT_PROVIDED';
      results.phoneCheck = {
        status: 'SKIPPED',
        details: 'Phone number not provided during user creation',
        required: false
      };
    }

    await Promise.all(checks);

    // Normalize overall risk score to 0-100
    if (riskFactors > 0) {
      results.overallRisk = Math.min(100, results.overallRisk);
    } else {
      // Set a default risk score if no checks were successful
      results.overallRisk = 30; // Default medium-low risk
    }

    // Save comprehensive check result to database
    try {
      await prisma.fraudDetection.create({
        data: {
          userId: userData.userId,
          verificationType: 'COMBINED_CHECK',
          ipAddress: userData.ipAddress,
          phoneNumber: userData.phoneNumber,
          requestData: {
            userId: userData.userId,
            ipAddress: userData.ipAddress,
            phoneNumber: userData.phoneNumber
          },
          responseData: results,
          riskScore: results.overallRisk,
          isFraudSuspected: results.overallRisk > 70, // Threshold for fraud suspicion
          detectionDetails: {
            ...results,
            summary: {
              ipCheck: results.ipCheck ? 'COMPLETED' : 'FAILED',
              phoneCheck: results.phoneStatus,
              checksPerformed,
              riskFactors
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to save fraud detection result:', error);
    }

    return results;
  }

  /**
   * Validates if the extracted document type matches the expected document type
   * Performs fuzzy matching to handle variations in document type names
   * @param expectedType - The expected document type from the database
   * @param extractedType - The document type extracted by Dojah
   * @returns boolean - True if types match, false otherwise
   */
  private validateDocumentTypeMatch(expectedType: string, extractedType: string): boolean {
    if (!expectedType || !extractedType || expectedType.trim() === '' || extractedType.trim() === '') {
      return false;
    }

    // Normalize both strings for comparison
    const normalize = (str: string): string => {
      return str.toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove special characters and spaces
        .trim();
    };

    const normalizedExpected = normalize(expectedType);
    const normalizedExtracted = normalize(extractedType);

    // Direct match
    if (normalizedExpected === normalizedExtracted) {
      return true;
    }

    // Define mapping of expected document types to possible extracted variations
    const documentTypeMappings: Record<string, string[]> = {
      'ID_CARD': [
        'idcard', 'identitycard', 'nationalid', 'nationalidcard', 'identity', 'id',
        'voterscard', 'voterid', 'nationalidentitycard', 'identitydocument','passport', 'internationalpassport', 'traveldocument', 'travelpassport',
        'diplomaticpassport', 'officialpassport', 'servicepassport','driverslicense', 'drivinglicense', 'driverlicense', 'driverslicence',
        'drivinglicence', 'driverlicence', 'license', 'licence','voterscard', 'voterid', 'voteridentitycard', 'voteridentification',
        'voteridcard', 'votersidentitycard'
      ],
      'PASSPORT': [
        'passport', 'internationalpassport', 'traveldocument', 'travelpassport',
        'diplomaticpassport', 'officialpassport', 'servicepassport'
      ],
      'DRIVERS_LICENSE': [
        'driverslicense', 'drivinglicense', 'driverlicense', 'driverslicence',
        'drivinglicence', 'driverlicence', 'license', 'licence'
      ],
      'VOTERS_CARD': [
        'voterscard', 'voterid', 'voteridentitycard', 'voteridentification',
        'voteridcard', 'votersidentitycard'
      ],
      'UTILITY_BILL': [
        'utilitybill', 'utility', 'electricitybill', 'waterbill', 'gasbill',
        'telephonebill', 'internetbill', 'cablebill', 'utilityreceipt'
      ],
      'UTILITY_RECEIPT': [
        'utilityreceipt', 'utilitybill', 'receipt', 'utility', 'electricityreceipt',
        'waterreceipt', 'gasreceipt', 'telephonereceipt'
      ],
      'BVN_SLIP': [
        'bvnslip', 'bvn', 'bankverificationnumber', 'bankverificationnumberslip',
        'bvndocument', 'bvnslip'
      ],
      'NIN_SLIP': [
        'ninslip', 'nin', 'nationalidentificationnumber', 'nationalidentificationnumberslip',
        'nindocument', 'ninslip'
      ],
      'CERTIFICATE_OF_REGISTRATION': [
        'certificateofregistration', 'registrationcertificate', 'businessregistration',
        'companyregistration', 'corporatecertificate', 'registrationdocument'
      ],
      'FORM_OF_APPLICATION': [
        'formofapplication', 'applicationform', 'application', 'form',
        'applicationdocument', 'formdocument'
      ],
      'VALID_ID_OF_PARTNERS': [
        'valididofpartners', 'partnersid', 'partneridentification', 'partnersidentification',
        'partnerid', 'partnersidentity'
      ],
      'PROOF_OF_ADDRESS': [
        'proofofaddress', 'addressproof', 'addressverification', 'residenceproof',
        'addressdocument', 'residenceverification'
      ],
      'CERTIFICATE_OF_INCORPORATION': [
        'certificateofincorporation', 'incorporationcertificate', 'incorporation',
        'companyincorporation', 'corporateincorporation', 'incorporationdocument'
      ],
      'MEMORANDUM_ARTICLES': [
        'memorandumarticles', 'memorandum', 'articles', 'memorandumandarticles',
        'articlesofassociation', 'memorandumofassociation', 'companyarticles'
      ],
      'BOARD_RESOLUTION': [
        'boardresolution', 'resolution', 'boarddecision', 'boardmeeting',
        'resolutiondocument', 'boarddecisiondocument'
      ],
      'DIRECTORS_ID': [
        'directorsid', 'directorid', 'directoridentification', 'directorsidentification',
        'directoridentity', 'directorsidentity', 'directordocument'
      ],
      'PASSPORT_PHOTOS': [
        'passportphotos', 'passportphoto', 'photographs', 'photos', 'photograph',
        'passportpicture', 'passportpictures', 'identityphotos'
      ],
      'BUSINESS_OWNER_ID': [
        'businessownerid', 'ownerid', 'businessowneridentification', 'owneridentification',
        'businessowneridentity', 'owneridentity', 'businessownerdocument'
      ]
    };

    // Check if the expected type has mappings
    const possibleMatches = documentTypeMappings[expectedType];
    if (possibleMatches) {
      return possibleMatches.some(match => normalizedExtracted.includes(match) || match.includes(normalizedExtracted));
    }

    // Fallback: check if either string contains the other (partial match)
    return normalizedExpected.includes(normalizedExtracted) || normalizedExtracted.includes(normalizedExpected);
  }
}

export const dojahService = new DojahService();
export default dojahService;
