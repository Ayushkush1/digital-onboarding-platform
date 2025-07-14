'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Upload, CheckCircle, User, Building, Building2, FileText, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  uploadKycDocument,
  validateIndividualDocument,
  validatePartnershipDocument,
  validateEnterpriseDocument,
  validateLlcDocument
} from '@/lib/file-upload-service';
import { DocumentType, VerificationStatusEnum } from '@/app/generated/prisma';
import { useVerificationStore } from '@/lib/verification-store';
import StepCompletionMessage from '@/components/StepCompletionMessage';

// Add custom style for animations
const fadeInAnimation = {
  opacity: 1,
  animation: 'fadeIn 0.5s ease-out forwards',
};

const slideUpAnimation = {
  transform: 'translateY(20px)',
  opacity: 1,
  animation: 'slideUp 0.5s ease-out forwards',
};

const pulseAnimation = {
  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
};


const TextInput = ({
  label,
  name,
  value,
  placeholder,
  onChange
}: {
  label: string,
  name: string,
  value: string,
  placeholder: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-2">
      {label}
    </label>
    <input
      type="text"
      name={name}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white/50 backdrop-blur-sm"
    />
  </div>
);

// Helper function to get required documents for each account type
const getRequiredDocumentsForAccountType = (type: string): string[] => {
  switch (type) {
    case 'individual':
      return ['idCardFront', 'idCardBack', 'passport', 'utilityBill']; // All four documents are required now
    case 'partnership':
      return ['certificateOfRegistration', 'validIdOfPartners'];
    case 'enterprise':
      return ['certificateOfRegistration', 'businessOwnerID'];
    case 'llc':
      return ['certificateOfIncorporation', 'directorsID'];
    default:
      return [];
  }
};

const formatDocumentName = (docType: string): string => {
  return docType.replace(/([A-Z])/g, ' $1').trim();
};

// SCUML validation function
const validateSCUMLNumber = (scumlNumber: string): boolean => {
  // Format: SC + 9 digits (e.g., SC123456789)
  const scumlPattern = /^SC\d{9}$/;
  return scumlPattern.test(scumlNumber);
};

// SCUML Toggle Component
const SCUMLToggle = ({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-center">
      <input
        type="checkbox"
        id="scuml-toggle"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <label htmlFor="scuml-toggle" className="ml-2 text-sm font-medium text-gray-700">
        I have a SCUML (Securities and Commodities Market License)
      </label>
    </div>
  </div>
);

// SCUML Number Input Component
const SCUMLInput = ({
  value,
  onChange,
  error
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string;
}) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-2">
      SCUML License Number <span className="text-rose-500">*</span>
    </label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder="SC123456789"
      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white/50 backdrop-blur-sm ${error ? 'border-red-300 bg-red-50' : 'border-slate-300'
        }`}
      maxLength={11}
    />
    {error && (
      <p className="mt-1 text-sm text-red-600">{error}</p>
    )}
    <p className="mt-1 text-xs text-slate-500">Format: SC followed by 9 digits (e.g., SC123456789)</p>
  </div>
);

// Helper function to convert form docType to valid DocumentType enum
const docTypeToEnumMapping = (docType: string): DocumentType => {
  const mapping: { [key: string]: DocumentType } = {
    // Individual documents
    idCard: DocumentType.ID_CARD, 
    idCardFront: DocumentType.ID_CARD,
    idCardBack: DocumentType.ID_CARD,
    passport: DocumentType.PASSPORT,
    utilityBill: DocumentType.UTILITY_BILL,

    // Partnership documents
    certificateOfRegistration: DocumentType.CERTIFICATE_OF_REGISTRATION,
    formOfApplication: DocumentType.FORM_OF_APPLICATION,
    validIdOfPartners: DocumentType.VALID_ID_OF_PARTNERS,
    proofOfAddress: DocumentType.PROOF_OF_ADDRESS,

    // Enterprise documents
    passportPhotos: DocumentType.PASSPORT_PHOTOS,
    utilityReceipt: DocumentType.UTILITY_RECEIPT,
    businessOwnerID: DocumentType.ID_CARD,

    // LLC documents
    certificateOfIncorporation: DocumentType.CERTIFICATE_OF_INCORPORATION,
    memorandumArticles: DocumentType.MEMORANDUM_ARTICLES,
    boardResolution: DocumentType.BOARD_RESOLUTION,
    directorsID: DocumentType.DIRECTORS_ID
  };

  return mapping[docType] || DocumentType.ID_CARD; // Default to ID_CARD if not found
};

const UploadKYCDocumentsPage = () => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [accountType, setAccountType] = useState('individual');
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [formDataLoaded, setFormDataLoaded] = useState(false);

  const {
    documents,
    kycStatus,
    fetchVerificationStatus,
    hasSubmittedDocuments
  } = useVerificationStore();

  // Check if documents were already submitted
  const alreadySubmitted = hasSubmittedDocuments();

  // Check if user has already completed document upload
  const isDocumentUploadComplete = kycStatus === VerificationStatusEnum.APPROVED ||
    (documents && documents.length > 0 && documents.every(doc => doc.verified));

  useEffect(() => {
    if (!loading && !user) {
      router.push('/access');
    } else if (user && !hasCheckedStatus) {
      setHasCheckedStatus(true);
      fetchVerificationStatus(user.id);
      loadFormData();
    }
  }, [user, loading, router, hasCheckedStatus, fetchVerificationStatus]);

  // Load existing form data from database
  const loadFormData = async () => {
    try {
      const response = await fetch('/api/user/kyc-form-data');
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          const data = result.data;
          setAccountType(data.accountType.toLowerCase());
          setBusinessName(data.businessName || '');
          setBusinessAddress(data.businessAddress || '');
          setTaxInfo({
            taxNumber: data.taxNumber || '',
            scumlNumber: data.scumlNumber || ''
          });
          // Set SCUML states
          setSCUMLNumber(data.scumlNumber || '');
          setHasSCUMLLicense(!!data.scumlNumber);
          setReferences({
            ref1Name: data.ref1Name || '',
            ref1Address: data.ref1Address || '',
            ref1Phone: data.ref1Phone || '',
            ref2Name: data.ref2Name || '',
            ref2Address: data.ref2Address || '',
            ref2Phone: data.ref2Phone || ''
          });
          if (data.extractedData) {
            setExtractedDocumentData(data.extractedData);
          }
          // Load TIN and CAC validation data
          setRcNumber(data.rcNumber || '');
          setTinValidationResult(data.tinValidationResult || null);
          setCacValidationResult(data.cacValidationResult || null);
          setFormDataLoaded(true);
        }
      }
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  };

  // Function to check verification status
  const checkVerificationStatus = async () => {
    setIsCheckingStatus(true);
    try {
      await fetchVerificationStatus(user!.id);
      // Show success message or update UI
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Save form data to database
  const saveFormData = async (isSubmitted = false) => {
    try {
      const formData = {
        accountType: accountType.toUpperCase(),
        businessName,
        businessAddress,
        taxNumber: taxInfo.taxNumber,
        scumlNumber: hasSCUMLLicense ? scumlNumber : '',
        references,
        extractedData: extractedDocumentData,
        isSubmitted,
        rcNumber,
        companyType: getCacCompanyType(accountType),
        tinValidationResult,
        cacValidationResult
      };

      const response = await fetch('/api/user/kyc-form-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save form data');
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving form data:', error);
      throw error;
    }
  };

  // If documents are already approved, show completion message
  if (isDocumentUploadComplete) {
    return (
      <StepCompletionMessage
        title="Documents Already Uploaded"
        message="You have already completed the document upload step. Your documents have been verified."
        backUrl="/user/verification-status"
        backButtonText="View Verification Status"
      />
    );
  }

  // We don't need the second effect that redirects automatically
  // This was causing the issue by preventing multiple document uploads

  const [showAccountOptions, setShowAccountOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: 'Choose File' | 'File Selected' | 'Uploading' | 'Uploaded' | 'Verifying' | 'Verified' | 'File Mismatched' }>({});
  const [documentErrors, setDocumentErrors] = useState<{ [key: string]: string }>({});

  // Individual account documents
  const [individualDocuments, setIndividualDocuments] = useState({
    idCardFront: null as File | null,
    idCardBack: null as File | null,
    passport: null as File | null,
    utilityBill: null as File | null
  });

  // Partnership account documents
  const [partnershipDocuments, setPartnershipDocuments] = useState({
    certificateOfRegistration: null as File | null,
    formOfApplication: null as File | null,
    validIdOfPartners: null as File | null,
    proofOfAddress: null as File | null
  });

  // Enterprise account documents
  const [enterpriseDocuments, setEnterpriseDocuments] = useState({
    certificateOfRegistration: null as File | null,
    formOfApplication: null as File | null,
    passportPhotos: null as File | null,
    utilityReceipt: null as File | null,
    businessOwnerID: null as File | null
  });

  // LLC account documents
  const [llcDocuments, setLlcDocuments] = useState({
    certificateOfIncorporation: null as File | null,
    memorandumArticles: null as File | null,
    boardResolution: null as File | null,
    directorsID: null as File | null,
    proofOfAddress: null as File | null
  });

  // References for all business types
  const [references, setReferences] = useState({
    ref1Name: '',
    ref1Address: '',
    ref1Phone: '',
    ref2Name: '',
    ref2Address: '',
    ref2Phone: ''
  });

  // Business address for enterprise and LLC
  const [businessAddress, setBusinessAddress] = useState('');

  // Tax and registration numbers for LLC
  const [taxInfo, setTaxInfo] = useState({
    taxNumber: '',
    scumlNumber: ''
  });

  // SCUML toggle and validation states
  const [hasSCUMLLicense, setHasSCUMLLicense] = useState(false);
  const [scumlNumber, setSCUMLNumber] = useState('');
  const [scumlError, setSCUMLError] = useState('');

  // File names for display
  const [fileNames, setFileNames] = useState({
    // Individual
    idCardFront: '',
    idCardBack: '',
    passport: '',
    utilityBill: '',

    // Partnership
    certificateOfRegistration: '',
    formOfApplication: '',
    validIdOfPartners: '',
    proofOfAddress: '',

    // Enterprise
    passportPhotos: '',
    utilityReceipt: '',
    businessOwnerID: '',

    // LLC
    certificateOfIncorporation: '',
    memorandumArticles: '',
    boardResolution: '',
    directorsID: ''
  });

  // File input refs
  const fileInputRefs = {
    // Individual
    idCardFront: useRef<HTMLInputElement>(null),
    idCardBack: useRef<HTMLInputElement>(null),
    passport: useRef<HTMLInputElement>(null),
    utilityBill: useRef<HTMLInputElement>(null),

    // Partnership
    certificateOfRegistration: useRef<HTMLInputElement>(null),
    formOfApplication: useRef<HTMLInputElement>(null),
    validIdOfPartners: useRef<HTMLInputElement>(null),
    proofOfAddress: useRef<HTMLInputElement>(null),

    // Enterprise
    passportPhotos: useRef<HTMLInputElement>(null),
    utilityReceipt: useRef<HTMLInputElement>(null),
    businessOwnerID: useRef<HTMLInputElement>(null),

    // LLC
    certificateOfIncorporation: useRef<HTMLInputElement>(null),
    memorandumArticles: useRef<HTMLInputElement>(null),
    boardResolution: useRef<HTMLInputElement>(null),
    directorsID: useRef<HTMLInputElement>(null)
  };

  const accountTypes = [
    { id: 'individual', name: 'Individual Account', icon: User },
    { id: 'partnership', name: 'Partnership Account', icon: Building },
    { id: 'enterprise', name: 'Enterprise Account', icon: Building2 },
    { id: 'llc', name: 'Limited Liability Account', icon: FileText }
  ];
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, docType: string, accountTypeKey: 'individual' | 'partnership' | 'enterprise' | 'llc') => {
    if (e.target.files && e.target.files[0]) {
      let file = e.target.files[0];
      console.log(`Processing file upload for ${docType}:`, file.name);

      // For ID Card Front/Back, rename the file to make it more distinctive
      if (docType === 'idCardFront' || docType === 'idCardBack') {
        // Create a new file object with a more distinctive name
        const newFileName = docType === 'idCardFront' 
          ? `ID_Card_Front_${Date.now()}${file.name.substr(file.name.lastIndexOf('.'))}`
          : `ID_Card_Back_${Date.now()}${file.name.substr(file.name.lastIndexOf('.'))}`;
          
        // Create a new File object with the renamed file
        file = new File([file], newFileName, { type: file.type });
        console.log(`Renamed file to: ${file.name}`);
      }

      // Map docType to appropriate DocumentType enum
      const documentEnum = docTypeToEnumMapping(docType);
      const docTypeFormatted = documentEnum.toString().replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      
      // Check for existing files - both locally and on server
      let isReplacing = false;

      // Check if we're replacing an existing local file
      switch (accountTypeKey) {
        case 'individual':
          isReplacing = !!individualDocuments[docType as keyof typeof individualDocuments];
          break;
        case 'partnership':
          isReplacing = !!partnershipDocuments[docType as keyof typeof partnershipDocuments];
          break;
        case 'enterprise':
          isReplacing = !!enterpriseDocuments[docType as keyof typeof enterpriseDocuments];
          break;
        case 'llc':
          isReplacing = !!llcDocuments[docType as keyof typeof llcDocuments];
          break;
      }
      
      // Check if this document exists on the server
      let existingServerDoc = false;
      if (docType === 'idCardFront') {
        existingServerDoc = documents?.some(doc => 
          (doc.type === 'Id Card' && doc.fileName.toLowerCase().includes('front')) || 
          doc.type === 'Id Card Front'
        );
      } else if (docType === 'idCardBack') {
        existingServerDoc = documents?.some(doc => 
          (doc.type === 'Id Card' && doc.fileName.toLowerCase().includes('back')) || 
          doc.type === 'Id Card Back'
        );
      } else {
        existingServerDoc = documents?.some(doc => doc.type === docTypeFormatted);
      }
      
      // Check if this document is already uploaded
      const isAlreadyUploaded = isReplacing || existingServerDoc;

      if (isAlreadyUploaded && !isReplacing) {
        console.log(`Document already exists for ${docType}. Preventing upload.`);
        setError(`This document type has already been uploaded. Each document can only be uploaded once.`);
        setDocumentErrors(prev => ({ ...prev, [docType]: 'This document type has already been uploaded.' }));
        return;
      }

      // Update file status to selected and start progress
      setUploadStatus(prev => ({ ...prev, [docType]: 'File Selected' }));
      setUploadProgress(prev => ({ ...prev, [docType]: 5 }));
      setDocumentErrors(prev => ({ ...prev, [docType]: '' })); // Clear any previous errors
      
      // Set up a progress simulation for the validation phase
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const currentProgress = prev[docType] || 0;
          // Don't exceed 60% for simulated progress
          const newProgress = Math.min(currentProgress + 3, 60);
          if (newProgress - currentProgress >= 3) {
            return { ...prev, [docType]: newProgress };
          }
          return prev;
        });
      }, 600);
      
      try {
        // Validate document before actually uploading it
        let validationResult: { isValid: boolean; extractedData?: any; message: string; } = { 
          isValid: false, 
          message: 'Document validation not performed' 
        };

        if (accountTypeKey === 'individual') {
          // For individual documents, validate with appropriate method
          if (docType === 'idCardFront' || docType === 'idCardBack') {
            validationResult = await validateIndividualDocument(documentEnum, file);
            setUploadProgress(prev => ({ ...prev, [docType]: 70 }));

            if (!validationResult.isValid) {
              clearInterval(progressInterval);
              setUploadStatus(prev => ({ ...prev, [docType]: 'File Mismatched' }));
              setError(`Document validation failed: ${validationResult.message}`);
              return;
            }

            // Store extracted data if available
            if (validationResult.extractedData) {
              setExtractedDocumentData(prev => ({
                ...prev,
                [docType]: validationResult.extractedData
              }));
            }
            
            // Update document states based on which side was uploaded
            if (docType === 'idCardFront') {
              console.log('Setting ID Card Front document:', file.name);
              setIndividualDocuments(prev => {
                const updated = { ...prev, idCardFront: file };
                console.log('Updated individual documents state:', updated);
                return updated;
              });
              setFileNames(prev => {
                const updated = { ...prev, idCardFront: file.name };
                console.log('Updated file names:', updated);
                return updated;
              });
            } else if (docType === 'idCardBack') {
              console.log('Setting ID Card Back document:', file.name);
              setIndividualDocuments(prev => {
                const updated = { ...prev, idCardBack: file };
                console.log('Updated individual documents state:', updated);
                return updated;
              });
              setFileNames(prev => {
                const updated = { ...prev, idCardBack: file.name };
                console.log('Updated file names:', updated);
                return updated;
              });
            }

            // Clear the progress simulation interval
            clearInterval(progressInterval);

            // Set upload as completed
            setUploadProgress(prev => ({ ...prev, [docType]: 100 }));
            setUploadStatus(prev => ({ ...prev, [docType]: 'Verified' }));
            setDocumentErrors(prev => ({ ...prev, [docType]: '' })); // Clear any previous errors
            return;
          } else {
            // Handle other individual documents (passport, utility bill)
            validationResult = await validateIndividualDocument(documentEnum, file);
          }
        }
        else if (accountTypeKey === 'partnership') {
          // Partnership validation logic
          validationResult = await validatePartnershipDocument(documentEnum, file);
        }
        else if (accountTypeKey === 'enterprise') {
          // Enterprise validation logic
          validationResult = await validateEnterpriseDocument(documentEnum, file);
        }
        else if (accountTypeKey === 'llc') {
          // Validate LLC documents
          validationResult = await validateLlcDocument(documentEnum, file);
          setUploadProgress(prev => ({ ...prev, [docType]: 70 }));

          // If validation fails, show error and return
          if (!validationResult.isValid) {
            clearInterval(progressInterval);
            setUploadStatus(prev => ({ ...prev, [docType]: 'File Mismatched' }));
            setError(`Document validation failed: ${validationResult.message}`);
            return;
          }

          // Process extracted data specific to LLC documents
          if (validationResult.extractedData) {
            setExtractedDocumentData(prev => ({
              ...prev,
              [docType]: validationResult.extractedData
            }));

            // Handle specific LLC document types with auto-filling data
            if (docType === 'certificateOfIncorporation') {
              if (validationResult.extractedData.businessName) {
                setBusinessName(validationResult.extractedData.businessName);
              }
              if (validationResult.extractedData.taxNumber) {
                setTaxInfo(prev => ({
                  ...prev,
                  taxNumber: validationResult.extractedData.taxNumber
                }));
              }
              if (validationResult.extractedData.businessAddress) {
                setBusinessAddress(validationResult.extractedData.businessAddress);
              }
            }
          }
        }
        
        // Process validation result for non-ID card documents
        // Special case for passport and utility bill which may get marked as invalid by Dojah but should be accepted
        if (docType === 'passport' || docType === 'utilityBill') {
          // If the file format is valid, allow it to be uploaded even if Dojah validation fails
          const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            console.log(`Applying special handling for ${docType} - allowing upload despite validation result`);
            // Let it continue to upload even if validationResult.isValid is false
          } else if (!validationResult || !validationResult.isValid) {
            clearInterval(progressInterval);
            setUploadStatus(prev => ({ ...prev, [docType]: 'File Mismatched' }));
            setError(`Document validation failed: ${validationResult?.message || 'Unknown error'}`);
            return;
          }
        } else if (!validationResult || !validationResult.isValid) {
          clearInterval(progressInterval);
          setUploadStatus(prev => ({ ...prev, [docType]: 'File Mismatched' }));
          setError(`Document validation failed: ${validationResult?.message || 'Unknown error'}`);
          return;
        }
        
        // Even if validation succeeded, store the file in the appropriate state
        // This ensures we have the file ready for resubmission in case of server errors

        // Update the appropriate document state based on account type
        switch (accountTypeKey) {
          case 'individual':
            if (docType === 'passport') {
              setIndividualDocuments(prev => {
                const updated = { ...prev, passport: file };
                console.log('Updated individual documents with passport:', updated);
                return updated;
              });
              setFileNames(prev => ({ ...prev, passport: file.name }));
            } else if (docType === 'utilityBill') {
              // For utility bill, ensure the filename is consistent
              const utilityFileName = `Utility_Bill_${Date.now()}${file.name.substr(file.name.lastIndexOf('.'))}`;
              const utilityFile = new File([file], utilityFileName, { type: file.type });
              
              setIndividualDocuments(prev => {
                const updated = { ...prev, utilityBill: utilityFile };
                console.log('Updated individual documents with utility bill:', updated);
                return updated;
              });
              setFileNames(prev => ({ ...prev, utilityBill: utilityFileName }));
              
              // Update the file reference for future use
              file = utilityFile;
            }
            break;
          case 'partnership':
            setPartnershipDocuments(prev => {
              const updated = { ...prev, [docType]: file };
              console.log(`Updated partnership documents with ${docType}:`, updated);
              return updated;
            });
            setFileNames(prev => ({ ...prev, [docType]: file.name }));
            break;
          case 'enterprise':
            setEnterpriseDocuments(prev => {
              const updated = { ...prev, [docType]: file };
              console.log(`Updated enterprise documents with ${docType}:`, updated);
              return updated;
            });
            setFileNames(prev => ({ ...prev, [docType]: file.name }));
            break;
          case 'llc':
            setLlcDocuments(prev => {
              const updated = { ...prev, [docType]: file };
              console.log(`Updated LLC documents with ${docType}:`, updated);
              return updated;
            });
            setFileNames(prev => ({ ...prev, [docType]: file.name }));
            break;
        }
        
        // Clear the progress simulation interval
        clearInterval(progressInterval);

        // Update progress and status
        setUploadProgress(prev => ({ ...prev, [docType]: 100 }));
        setUploadStatus(prev => ({ ...prev, [docType]: 'Verified' }));
        setDocumentErrors(prev => ({ ...prev, [docType]: '' })); // Clear any previous errors
        console.log(`Document ${docType} uploaded successfully`);

      } catch (error) {
        // Clear the progress simulation interval
        clearInterval(progressInterval);

        console.error(`Error handling file upload for ${docType}:`, error);
        setUploadStatus(prev => ({ ...prev, [docType]: 'File Mismatched' }));
        const errorMessage = error instanceof Error ? error.message : 'An error occurred during file processing';
        setError(errorMessage);
        setDocumentErrors(prev => ({ ...prev, [docType]: errorMessage }));
      }
    }
  };

  // Add a new state to store extracted document data
  const [extractedDocumentData, setExtractedDocumentData] = useState<{ [key: string]: any }>({});
  const [businessName, setBusinessName] = useState('');

  // Function to trigger combined ID card verification when both front and back are uploaded
  const triggerCombinedIdCardVerification = async (): Promise<void> => {
    try {
      console.log("Triggering combined ID card verification");
      setError('');

      // Double check that both documents are still available
      if (!individualDocuments.idCardFront || !individualDocuments.idCardBack) {
        console.error('Missing front or back ID card documents', {
          front: !!individualDocuments.idCardFront,
          back: !!individualDocuments.idCardBack
        });
        setError('Both front and back ID card documents must be uploaded before verification');
        return;
      }

      console.log('Front document ready:', individualDocuments.idCardFront?.name);
      console.log('Back document ready:', individualDocuments.idCardBack?.name);

      try {
        // Perform the combined verification
        const result = await validateIndividualDocument(
          DocumentType.ID_CARD,
          individualDocuments.idCardFront,
          individualDocuments.idCardBack
        );

        if (!result.isValid) {
          setError(result.message || 'ID card verification failed');
          return;
        }

        // If validation succeeds, proceed with the upload
        await Promise.all([
          uploadKycDocument(
            DocumentType.ID_CARD,
            individualDocuments.idCardFront,
            (progress) => setUploadProgress(prev => ({ ...prev, idCardFront: progress }))
          ),
          uploadKycDocument(
            DocumentType.ID_CARD,
            individualDocuments.idCardBack,
            (progress) => setUploadProgress(prev => ({ ...prev, idCardBack: progress }))
          )
        ]);

        // Update status after successful upload
        setUploadStatus(prev => ({
          ...prev,
          idCardFront: 'Verified',
          idCardBack: 'Verified'
        }));
        
        // Clear any previous errors for these documents
        setDocumentErrors(prev => ({
          ...prev,
          idCardFront: '',
          idCardBack: ''
        }));

      } catch (error) {
        console.error('Error during combined verification:', error);
        setError('Failed to verify ID card. Please try again.');
        setUploadStatus(prev => ({
          ...prev,
          idCardFront: 'File Mismatched',
          idCardBack: 'File Mismatched'
        }));
      }

    } catch (error) {
      console.error('Error in triggerCombinedIdCardVerification:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setReferences(prev => ({ ...prev, [name]: value }));
  };

  const handleTaxInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTaxInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSCUMLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setSCUMLNumber(value);

    // Validate SCUML format in real-time
    if (value && !validateSCUMLNumber(value)) {
      setSCUMLError('SCUML number must be in format SC followed by 9 digits (e.g., SC123456789)');
    } else {
      setSCUMLError('');
    }
  };

  const handleSCUMLToggle = (checked: boolean) => {
    setHasSCUMLLicense(checked);
    if (!checked) {
      setSCUMLNumber('');
      setSCUMLError('');
    }
  };

  // Add company type options for CAC
  const companyTypeOptions = [
    { value: 'BUSINESS_NAME', label: 'Business Name' },
    { value: 'COMPANY', label: 'Company' },
    { value: 'INCORPORATED_TRUSTEES', label: 'Incorporated Trustees' },
    { value: 'LIMITED_PARTNERSHIP', label: 'Limited Partnership' },
    { value: 'LIMITED_LIABILITY_PARTNERSHIP', label: 'Limited Liability Partnership' },
  ];

  // Function to convert account type to CAC company type
  const getCacCompanyType = (accountType: string): string => {
    switch (accountType) {
      case 'partnership':
        return 'LIMITED_PARTNERSHIP';
      case 'enterprise':
        return 'BUSINESS_NAME';
      case 'llc':
        return 'COMPANY';
      default:
        return 'BUSINESS_NAME';
    }
  };

  const [rcNumber, setRcNumber] = useState('');
  const [tinValidationResult, setTinValidationResult] = useState<any>(null);
  const [cacValidationResult, setCacValidationResult] = useState<any>(null);
  const [cacValidationError, setCacValidationError] = useState('');
  const [tinValidationError, setTinValidationError] = useState('');
  const [isValidatingTin, setIsValidatingTin] = useState(false);
  const [isValidatingCac, setIsValidatingCac] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setTinValidationError('');
    setCacValidationError('');
    setTinValidationResult(null);
    setCacValidationResult(null);
    const isBusinessAccount = ['partnership', 'enterprise', 'llc'].includes(accountType);
    try {
      // 1. Validate TIN and CAC first (if provided)
      let tinValid = true;
      let cacValid = true;
      if (isBusinessAccount) {
        // Validate TIN if provided
        if (taxInfo.taxNumber) {
          setIsValidatingTin(true);
          try {
            const tinRes = await fetch(`/api/user/nigeria-validation?tin=${encodeURIComponent(taxInfo.taxNumber)}`);
            const tinData = await tinRes.json();
            if (!tinRes.ok || !tinData.entity) {
              setTinValidationError(tinData.error || 'Invalid TIN');
              setIsSubmitting(false);
              setIsValidatingTin(false);
              setError('Invalid TIN. Please check and try again.');
              tinValid = false;
            } else {
              setTinValidationResult(tinData.entity);
            }
          } catch (err) {
            setTinValidationError('TIN validation failed.');
            setIsSubmitting(false);
            setIsValidatingTin(false);
            setError('TIN validation failed.');
            tinValid = false;
          }
          setIsValidatingTin(false);
        }
        // Validate CAC if provided
        if (rcNumber) {
          const cacCompanyType = getCacCompanyType(accountType);
          setIsValidatingCac(true);
          try {
            const cacRes = await fetch(`/api/user/nigeria-validation?rc_number=${encodeURIComponent(rcNumber)}&company_type=${encodeURIComponent(cacCompanyType)}`);
            const cacData = await cacRes.json();
            if (!cacRes.ok || !cacData.entity) {
              setCacValidationError(cacData.error || 'Invalid CAC details');
              setIsSubmitting(false);
              setIsValidatingCac(false);
              setError('Invalid CAC details. Please check and try again.');
              cacValid = false;
            } else {
              setCacValidationResult(cacData.entity);
              // Autofill business name/address if available
              if (cacData.entity.company_name) setBusinessName(cacData.entity.company_name);
              if (cacData.entity.address) setBusinessAddress(cacData.entity.address);
            }
          } catch (err) {
            setCacValidationError('CAC validation failed.');
            setIsSubmitting(false);
            setIsValidatingCac(false);
            setError('CAC validation failed.');
            cacValid = false;
          }
          setIsValidatingCac(false);
        }
      }
      // Only proceed to save if both TIN and CAC are valid (or not provided)
      if (tinValid && cacValid) {
        // ... rest of handleSubmit ...
        // Save form data
        await saveFormData(true);
        setIsSubmitted(true);
        setIsSubmitting(false);
        return;
      } else {
        // Do not save, error already set
        setIsSubmitting(false);
        return;
      }
    } catch (error) {
      console.error('Error during form submission:', error);
      setError('An error occurred during submission. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Helper function to get the file by type and account type
  const getFileByType = (accountType: string, docType: string): File | null => {
    switch (accountType) {
      case 'individual':
        return individualDocuments[docType as keyof typeof individualDocuments];
      case 'partnership':
        return partnershipDocuments[docType as keyof typeof partnershipDocuments];
      case 'enterprise':
        return enterpriseDocuments[docType as keyof typeof enterpriseDocuments];
      case 'llc':
        return llcDocuments[docType as keyof typeof llcDocuments];
      default:
        return null;
    }
  };

  // Debug helper function to log document states
  const logDocumentStates = () => {
    console.log('===== DOCUMENT STATE DEBUG =====');
    console.log('Individual documents:', Object.keys(individualDocuments).map(key => ({
      type: key,
      exists: !!individualDocuments[key as keyof typeof individualDocuments],
      name: individualDocuments[key as keyof typeof individualDocuments]?.name || 'N/A'
    })));
    console.log('Partnership documents:', Object.keys(partnershipDocuments).map(key => ({
      type: key,
      exists: !!partnershipDocuments[key as keyof typeof partnershipDocuments],
      name: partnershipDocuments[key as keyof typeof partnershipDocuments]?.name || 'N/A'
    })));
    console.log('Enterprise documents:', Object.keys(enterpriseDocuments).map(key => ({
      type: key,
      exists: !!enterpriseDocuments[key as keyof typeof enterpriseDocuments],
      name: enterpriseDocuments[key as keyof typeof enterpriseDocuments]?.name || 'N/A'
    })));
    console.log('LLC documents:', Object.keys(llcDocuments).map(key => ({
      type: key,
      exists: !!llcDocuments[key as keyof typeof llcDocuments],
      name: llcDocuments[key as keyof typeof llcDocuments]?.name || 'N/A'
    })));
    console.log('File names state:', fileNames);
    console.log('Upload status:', uploadStatus);
    console.log('============================');
  };
  
  // File upload component
  const FileUploadBox = ({
    docType,
    label,
    accountTypeKey,
    fileRef
  }: {
    docType: string,
    label: string,
    accountTypeKey: 'individual' | 'partnership' | 'enterprise' | 'llc',
    fileRef: React.RefObject<HTMLInputElement>
  }) => {    // Determine if file is uploaded based on account type and document type
    let isFileUploaded = false;
    let fileName = '';
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    switch (accountTypeKey) {
      case 'individual':
        isFileUploaded = !!individualDocuments[docType as keyof typeof individualDocuments];
        break;
      case 'partnership':
        isFileUploaded = !!partnershipDocuments[docType as keyof typeof partnershipDocuments];
        break;
      case 'enterprise':
        isFileUploaded = !!enterpriseDocuments[docType as keyof typeof enterpriseDocuments];
        break;
      case 'llc':
        isFileUploaded = !!llcDocuments[docType as keyof typeof llcDocuments];
        break;
    }

    // Check if this document is already in the server documents list
    const documentEnum = docTypeToEnumMapping(docType);
    const docTypeFormatted = documentEnum.toString().replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    
    // For ID Card, we need to distinguish between front and back
    let existingServerDoc;
    if (docType === 'idCardFront') {
      existingServerDoc = documents?.find(doc => 
        (doc.type === docTypeFormatted || doc.type === 'Id Card') && 
        (doc.fileName?.toLowerCase().includes('front') || doc.id.includes('front'))
      );
    } else if (docType === 'idCardBack') {
      existingServerDoc = documents?.find(doc => 
        (doc.type === docTypeFormatted || doc.type === 'Id Card') && 
        (doc.fileName?.toLowerCase().includes('back') || doc.id.includes('back'))
      );
    } else {
      existingServerDoc = documents?.find(doc => doc.type === docTypeFormatted);
    }

    // Set the filename from various possible sources in order of priority
    if (existingServerDoc && existingServerDoc.fileName) {
      fileName = existingServerDoc.fileName;
      isFileUploaded = true;
    } else if (fileNames[docType as keyof typeof fileNames]) {
      fileName = fileNames[docType as keyof typeof fileNames];
    } else {
      // If no filename is set, try to get it from the file object
      const file = getFileByType(accountTypeKey, docType);
      if (file) {
        fileName = file.name;
      }
    }

    const progress = uploadProgress[docType] || 0;
    const status = uploadStatus[docType] || (existingServerDoc ? 'Verified' : 'Choose File');
    const documentError = documentErrors[docType];

    // Create preview for image files
    const handlePreview = (file: File) => {
      // Only create previews for images, not PDFs
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        // For PDFs, just show an icon
        setPreviewUrl(null);
      }
    };

    // Handle drag events
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isFileUploaded && status !== 'Uploading') {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!isFileUploaded && status !== 'Uploading' && fileRef.current) {
        const dt = e.dataTransfer;
        if (dt.files && dt.files.length > 0) {
          console.log(`File dropped for ${docType}:`, dt.files[0].name);
          
          // Create a synthetic event to be used with handleFileChange
          const files = dt.files;
          const newEvent = {
            target: {
              files
            },
            preventDefault: () => { },
            stopPropagation: () => { }
          } as unknown as React.ChangeEvent<HTMLInputElement>;

          // Process the file upload
          handleFileChange(newEvent, docType, accountTypeKey);
          
          // Force a UI update for the specific document type
          setTimeout(() => {
            // Check if the file was properly stored
            const storedFile = getFileByType(accountTypeKey, docType);
            console.log(`After drop processing: ${docType} file stored:`, !!storedFile);
            
            // Re-trigger state update to ensure UI reflects the change
            if (storedFile) {
              setUploadStatus(prev => ({ ...prev, [docType]: 'Verified' }));
              
              // Also make sure the filename is set
              if (!fileNames[docType as keyof typeof fileNames]) {
                setFileNames(prev => ({ ...prev, [docType]: storedFile.name }));
              }
            }
          }, 100);
        }
      }
    };

    // Update the component to show preview when a file is selected
    useEffect(() => {
      const file = getFileByType(accountTypeKey, docType);
      if (file) {
        console.log(`Generating preview for ${docType} file:`, file.name);
        handlePreview(file);
      }
    }, [
      accountTypeKey, 
      docType, 
      // Include these dependencies to re-trigger preview when document states change
      accountTypeKey === 'individual' ? individualDocuments : null,
      accountTypeKey === 'partnership' ? partnershipDocuments : null,
      accountTypeKey === 'enterprise' ? enterpriseDocuments : null,
      accountTypeKey === 'llc' ? llcDocuments : null
    ]);

    // Helper function to format file size
    const formatFileSize = (size: number): string => {
      if (size < 1024) return `${size} B`;
      else if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      else return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    const fileSize = getFileByType(accountTypeKey, docType)?.size;
    const formattedFileSize = fileSize ? formatFileSize(fileSize) : '';

    // Get file icon based on file type
    const getFileIcon = (fileName: string) => {
      if (!fileName) return null;
      const extension = fileName.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif'].includes(extension || '')) {
        return '🖼️';
      } else if (extension === 'pdf') {
        return '📄';
      } else {
        return '📎';
      }
    };

    const fileIcon = getFileIcon(fileName);

    // Helper to determine if a document is required
    const isRequired = getRequiredDocumentsForAccountType(accountTypeKey).includes(docType);

    return (
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-slate-700">
            {label} {isRequired && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-xs py-0.5 px-2 rounded-full bg-slate-100 text-slate-700">
            {status}
          </span>
        </div>
        {status === 'File Selected' && (
          <button type="button" onClick={() => fileRef.current?.click()} className="ml-2 text-blue-600 underline text-xs">Replace File</button>
        )}
        {status === 'File Mismatched' && (
          <button 
            type="button" 
            onClick={() => fileRef.current?.click()} 
            className="ml-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium py-1 px-3 rounded-full text-xs flex items-center"
          >
            <Upload className="h-3 w-3 mr-1" /> Re-upload File
          </button>
        )}
        <div
          className={`border-2 border-dashed rounded-lg p-4 transition-all duration-300 relative h-[180px] ${isDragging ? 'border-blue-500 bg-blue-50' :
            status === 'Verified' ? 'border-green-300 bg-green-50' :
              status === 'File Mismatched' ? 'border-red-300 bg-red-50' :
                isFileUploaded ? 'border-blue-300 bg-blue-50/50' :
                  'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
            }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {status === 'Uploading' ? (<div className="flex flex-col items-center py-4 absolute top-0 left-0 right-0 bottom-0 justify-center transition-opacity duration-300">
            <div className="mb-4 relative">
              <div className="h-16 w-16 rounded-full flex items-center justify-center bg-blue-50">
                <div className="h-10 w-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-blue-800">{progress}%</span>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-800 text-center max-w-[200px] truncate">{fileName}</p>
            <div className="w-full max-w-xs mt-3 bg-blue-100 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full shadow-inner shadow-blue-800/20" style={{
                width: `${progress}%`,
                transitionProperty: 'width',
                transitionDuration: '0.3s',
                transitionTimingFunction: 'ease'
              }}></div>
            </div>
            <p className="text-xs text-blue-700 mt-2 font-medium">
              {progress < 20 ? 'Preparing document...' :
                progress < 60 ? `Validating and processing...` :
                  progress < 90 ? 'Uploading file...' :
                    'Finalizing submission...'}
            </p>
          </div>) : status === 'Verified' ? (
            <div className="flex items-center p-2 absolute top-0 left-0 right-0 bottom-0 justify-center">
              <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 border border-green-200">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <div className="ml-4 flex-grow flex gap-10">
                <div className='flex flex-col justify-center w-1/2'>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-slate-800">{fileIcon} {fileName}</span>
                    {formattedFileSize && <span className="text-xs text-slate-500 ml-2">({formattedFileSize})</span>}
                  </div>
                  <p className="text-xs text-green-600 font-medium mt-0.5">Verification successful</p>

                </div>

                {previewUrl && (<div className="mt-2 max-w-[900px]">
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="h-32 w-32 object-cover rounded border border-green-200 shadow-sm"
                  />
                </div>
                )}
              </div>
            </div>) : status === 'File Mismatched' ? (
              <div className="flex items-center p-2 absolute top-0 left-0 right-0 bottom-0 justify-center">
                <div className="h-14 w-14 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 border border-red-200">
                  <AlertCircle className="h-7 w-7 text-red-600" />
                </div>
                <div className="ml-4 flex-grow">
                  <p className="text-sm font-medium text-slate-800">{fileName || 'Upload failed'}</p>
                  <p className="text-xs text-red-600 font-medium mt-0.5">
                    {documentError || (docType === 'utilityBill' ? 
                      'Error: Please ensure your file is a recent utility bill (less than 3 months old)' : 
                      'Verification failed')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {docType === 'utilityBill' ? 
                      'Try a different document format (JPG or PDF)' : 
                      'Please check the document and try again'}
                  </p>
                </div>
              </div>) : isFileUploaded ? (
                <div className="flex items-center p-2 absolute top-0 left-0 right-0 bottom-0 justify-center">
                  <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 border border-blue-200">
                    <CheckCircle className="h-7 w-7 text-blue-600" />
                  </div>
                  <div className="ml-4 flex-grow">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-slate-800">{fileIcon} {fileName}</span>
                      {formattedFileSize && <span className="text-xs text-slate-500 ml-2">({formattedFileSize})</span>}
                    </div>
                    <p className="text-xs text-blue-600 font-medium mt-0.5">File ready for submission</p>
                    {previewUrl && (
                      <div className="mt-2 max-w-[150px]">
                        <img
                          src={previewUrl}
                          alt="Document preview"
                          className="h-16 w-auto object-cover rounded border border-blue-200 shadow-sm"
                        />
                      </div>)}
                  </div>
                </div>) : (<div
                  className={`flex flex-col items-center py-6 cursor-pointer absolute top-0 left-0 right-0 bottom-0 justify-center ${isDragging ? 'opacity-70' : ''}`}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-3 transition-all ${isDragging ? 'bg-blue-100' : 'bg-slate-50 border border-slate-200'}`}>
                    <Upload className={`h-8 w-6 transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <p className={`text-sm font-medium transition-colors ${isDragging ? 'text-blue-700' : 'text-slate-800'}`}>
                    {isDragging ? 'Drop file here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Support: JPG, PNG, PDF (max 5MB)</p>
                  <button
                    type="button"
                    className="mt-3 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm" onClick={(e) => {
                      e.stopPropagation();
                      if (fileRef.current) {
                        fileRef.current.value = '';
                        setError('');
                        fileRef.current.click();
                      }
                    }}
                  >
                    Select File
                  </button><input
                    type="file"
                    ref={fileRef}
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={e => {
                      // Reset any error state before attempting upload
                      setError('');
                      // Process the file change
                      handleFileChange(e, docType, accountTypeKey);
                      // Clear the input value after processing to allow selecting the same file again
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                  />
                </div>
          )}
        </div>
      </div>
    );
  };

  // Text input component for references

  // Success screen component
  const SuccessScreen = () => {
    return (
      <div className="min-h-[80vh] flex items-center justify-center pt-10 pb-20 px-4">
        <div className="max-w-md w-full mx-auto rounded-2xl shadow-lg overflow-hidden border bg-white">
          <div className="bg-gradient-to-r from-green-600 to-emerald-500 py-10 px-6">
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-white text-2xl font-bold mb-1">Documents Submitted!</h2>
              <p className="text-green-100">Your verification is in progress</p>
            </div>
          </div>

          <div className="p-8">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-green-800">Submission Complete</h3>
                  <p className="text-sm text-green-700 mt-1">Your documents have been uploaded successfully and are now being processed.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h3 className="text-lg font-semibold text-gray-800">What's Next?</h3>
              <div className="flex items-start">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                  <span className="text-blue-700 text-xs font-bold">1</span>
                </div>
                <p className="text-gray-700 ml-3 text-sm">Our system will automatically validate your documents</p>
              </div>
              <div className="flex items-start">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                  <span className="text-blue-700 text-xs font-bold">2</span>
                </div>
                <p className="text-gray-700 ml-3 text-sm">Complete the selfie verification to confirm your identity</p>
              </div>
              <div className="flex items-start">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                  <span className="text-blue-700 text-xs font-bold">3</span>
                </div>
                <p className="text-gray-700 ml-3 text-sm">Once approved, you'll receive full access to your account</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/user/selfie-verification')}
              className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center"
            >
              <span className="mr-2">Proceed to Selfie Verification</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Already submitted screen component with Check Now button
  const AlreadySubmittedScreen = () => {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full mx-auto rounded-2xl shadow-lg overflow-hidden border bg-white">
          <div className="bg-gradient-to-r from-amber-500 to-orange-400 py-10 px-6">
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white">
                <AlertCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-white text-2xl font-bold mb-1">Already Submitted</h2>
              <p className="text-amber-100">Your documents are being processed</p>
            </div>
          </div>

          <div className="p-8">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-amber-800">Documents Under Review</h3>
                  <p className="text-sm text-amber-700 mt-1">You've already submitted KYC documents. Our team is currently reviewing them.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Verification Status</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-1/3">
                    <span className="text-xs font-medium text-slate-500">Submission Date:</span>
                  </div>
                  <div className="w-2/3">
                    <span className="text-sm font-medium text-slate-700">
                      {documents && documents.length > 0 ? new Date(documents[0].uploadedAt).toLocaleDateString() : 'Processing'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-1/3">
                    <span className="text-xs font-medium text-slate-500">Status:</span>
                  </div>
                  <div className="w-2/3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {kycStatus || 'Under Review'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-1/3">
                    <span className="text-xs font-medium text-slate-500">Documents:</span>
                  </div>
                  <div className="w-2/3">
                    <span className="text-sm font-medium text-slate-700">
                      {documents ? documents.length : 0} uploaded
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={checkVerificationStatus}
                disabled={isCheckingStatus}
                className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center"
              >
                {isCheckingStatus ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    <span>Checking Status...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    <span>Check Now</span>
                  </>
                )}
              </button>

              <button
                onClick={() => router.push('/user/dashboard')}
                className="w-full py-4 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all duration-300 flex items-center justify-center"
              >
                <span className="mr-2">Go to Dashboard</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // If documents are submitted, show success screen
  if (isSubmitted) {
    return <SuccessScreen />;
  }

  // If user has already submitted documents before, show the already submitted screen
  if (alreadySubmitted) {
    return <AlreadySubmittedScreen />;
  }

  // Show loading state while form data is being loaded

  if (formDataLoaded && user) {
    return (

      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your form data... </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 rounded">
      <div className='rounded-xl shadow-lg p-6 md:p-8 bg-white border border-slate-100'>
        <div className="rounded-t-xl bg-gradient-to-r from-blue-700 to-blue-500 -m-8 mb-8 p-8 text-white shadow-md">
          <h2 className="text-3xl font-bold mb-3">Upload KYC Documents</h2>
          <p className="text-blue-100 max-w-2xl">Please upload the required documents for identity verification. Your information is securely encrypted and verified.</p>


        </div>

        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5 mb-10 shadow-sm">
          <div className="flex items-start">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 border border-amber-200">
              <AlertCircle className="text-amber-600 h-5 w-5" />
            </div>
            <div className="ml-4">
              <p className="font-semibold text-amber-800">Important Document Guidelines</p>
              <ul className="mt-2 text-amber-700 text-sm space-y-1 grid grid-cols-2">
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  All documents must be clear, unaltered, and unexpired
                </li>
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  Supported file formats: JPG, PNG, PDF (maximum 5MB each)
                </li>
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  Required fields are marked with an asterisk (*)
                </li>
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  Documents will be automatically validated before submission
                </li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>          <div className="mb-8">
          <label className="block text-sm font-medium text-slate-700 mb-4">
            Select Account Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {accountTypes.map(type => {
              const Icon = type.icon;
              const isSelected = type.id === accountType;

              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setAccountType(type.id)}
                  className={`relative h-24 rounded-xl transition-all duration-300 border-2 flex flex-col items-center justify-center gap-2 ${isSelected
                    ? 'bg-blue-50 border-blue-500 shadow-md'
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                    }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                  </div>
                  <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                    {type.name}
                  </span>

                  {isSelected && (
                    <div className="absolute top-2 right-2 h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>          {/* Individual Account Requirements */}
          {accountType === 'individual' && (
            <div className="mb-10" style={fadeInAnimation}>
              <div className="flex items-center mb-6 pb-3 border-b border-slate-200">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Individual Requirements</h3>
                  <p className="text-sm text-slate-500">Upload clear images of your personal identification documents</p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">1</span>
                  Required Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6" style={slideUpAnimation}>
                  <FileUploadBox
                    docType="idCardFront"
                    label="ID Card (Front Side)"
                    accountTypeKey="individual"
                    fileRef={fileInputRefs.idCardFront}
                  />

                  <FileUploadBox
                    docType="idCardBack"
                    label="ID Card (Back Side)"
                    accountTypeKey="individual"
                    fileRef={fileInputRefs.idCardBack}
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">2</span>
                  Additional Required Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6" style={slideUpAnimation}>
                  <FileUploadBox
                    docType="passport"
                    label="Passport"
                    accountTypeKey="individual"
                    fileRef={fileInputRefs.passport}
                  />

                  <FileUploadBox
                    docType="utilityBill"
                    label="Utility Bill (not older than 3 months)"
                    accountTypeKey="individual"
                    fileRef={fileInputRefs.utilityBill}
                  />
                </div>
              </div>


            </div>
          )}          {/* Partnership Account Requirements */}
          {accountType === 'partnership' && (
            <div className="mb-10" style={fadeInAnimation}>
              <div className="flex items-center mb-6 pb-3 border-b border-slate-200">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <Building className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Partnership Account Requirements</h3>
                  <p className="text-sm text-slate-500">Upload all required business registration and partner identification documents</p>
                </div>
              </div>

              {/* SCUML Section - First Priority */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">1</span>
                  Securities License Information
                </h4>
                <div className="space-y-4">
                  <SCUMLToggle
                    checked={hasSCUMLLicense}
                    onChange={handleSCUMLToggle}
                  />
                  {hasSCUMLLicense && (
                    <SCUMLInput
                      value={scumlNumber}
                      onChange={handleSCUMLChange}
                      error={scumlError}
                    />
                  )}
                </div>
              </div>

              {/* TIN and CAC Validation Section */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">2</span>
                  Business Registration Validation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tax Identification Number (TIN)
                    </label>
                    <input
                      type="text"
                      name="taxNumber"
                      value={taxInfo.taxNumber}
                      placeholder="Enter TIN"
                      onChange={handleTaxInfoChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white/50 backdrop-blur-sm"
                    />
                    {tinValidationError && (
                      <p className="mt-1 text-sm text-red-600">{tinValidationError}</p>
                    )}
                    {tinValidationResult && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">✓ TIN Validated</p>
                        <p className="text-xs text-green-700">{tinValidationResult.taxpayer_name || tinValidationResult.search}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      CAC RC Number
                    </label>
                    <input
                      type="text"
                      name="rcNumber"
                      value={rcNumber}
                      placeholder="Enter RC Number"
                      onChange={e => setRcNumber(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white/50 backdrop-blur-sm"
                    />
                    {cacValidationError && (
                      <p className="mt-1 text-sm text-red-600">{cacValidationError}</p>
                    )}
                    {cacValidationResult && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">✓ CAC Validated</p>
                        <p className="text-xs text-green-700">{cacValidationResult.company_name}</p>
                        <p className="text-xs text-green-700">{cacValidationResult.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Show other fields only if no SCUML license or SCUML is valid */}
              <>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                  <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">2</span>
                    Required Business Documents
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6" style={slideUpAnimation}>
                    <FileUploadBox
                      docType="certificateOfRegistration"
                      label="Certificate of Registration (Original to be sighted)"
                      accountTypeKey="partnership"
                      fileRef={fileInputRefs.certificateOfRegistration}
                    />

                    <FileUploadBox
                      docType="validIdOfPartners"
                      label="Valid Identification of Partners"
                      accountTypeKey="partnership"
                      fileRef={fileInputRefs.validIdOfPartners}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                  <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">2</span>
                    Additional Documents
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6" style={slideUpAnimation}>
                    <FileUploadBox
                      docType="formOfApplication"
                      label="Form of Application for Registration (Certified by CAC)"
                      accountTypeKey="partnership"
                      fileRef={fileInputRefs.formOfApplication}
                    />

                    <FileUploadBox
                      docType="proofOfAddress"
                      label="Proof of Address (Utility Bill, Bank Statement, etc.)"
                      accountTypeKey="partnership"
                      fileRef={fileInputRefs.proofOfAddress}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                  <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">3</span>
                    Corporate References
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 py-0.5 px-2 rounded-full">Required</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6" style={slideUpAnimation}>
                    <div className="p-5 border border-slate-200 rounded-lg bg-white shadow-sm">
                      <div className="flex items-center mb-4">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center mr-2">
                          <span className="font-semibold text-slate-600 text-sm">1</span>
                        </div>
                        <h5 className="font-medium text-slate-700">First Reference</h5>
                      </div>
                      <div className="space-y-4">
                        <TextInput
                          label="Name"
                          name="ref1Name"
                          value={references.ref1Name}
                          placeholder="Company/Individual Name"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Address"
                          name="ref1Address"
                          value={references.ref1Address}
                          placeholder="Full Address"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Phone Number"
                          name="ref1Phone"
                          value={references.ref1Phone}
                          placeholder="Contact Number"
                          onChange={handleReferenceChange}
                        />
                      </div>
                    </div>

                    <div className="p-5 border border-slate-200 rounded-lg bg-white shadow-sm">
                      <div className="flex items-center mb-4">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center mr-2">
                          <span className="font-semibold text-slate-600 text-sm">2</span>
                        </div>
                        <h5 className="font-medium text-slate-700">Second Reference</h5>
                      </div>
                      <div className="space-y-4">
                        <TextInput
                          label="Name"
                          name="ref2Name"
                          value={references.ref2Name}
                          placeholder="Company/Individual Name"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Address"
                          name="ref2Address"
                          value={references.ref2Address}
                          placeholder="Full Address"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Phone Number"
                          name="ref2Phone"
                          value={references.ref2Phone}
                          placeholder="Contact Number"
                          onChange={handleReferenceChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Show auto-filled data notice */}
                {extractedDocumentData.certificateOfRegistration && (
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg shadow-sm" style={slideUpAnimation}>
                    <div className="flex items-start">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-800 mb-2">Data Extracted Successfully</h4>
                        <p className="text-sm text-blue-700 mb-3">
                          We've automatically extracted the following information from your uploaded documents:
                        </p>
                        <div className="bg-white rounded-md p-3 border border-blue-200">
                          {extractedDocumentData.certificateOfRegistration.businessName && (
                            <div className="flex items-center mb-2">
                              <span className="text-xs text-blue-500 font-medium w-36">Business Name:</span>
                              <span className="text-sm font-medium">{extractedDocumentData.certificateOfRegistration.businessName}</span>
                            </div>
                          )}
                          {extractedDocumentData.certificateOfRegistration.registrationNumber && (
                            <div className="flex items-center mb-2">
                              <span className="text-xs text-blue-500 font-medium w-36">Registration Number:</span>
                              <span className="text-sm font-medium">{extractedDocumentData.certificateOfRegistration.registrationNumber}</span>
                            </div>
                          )}
                          {extractedDocumentData.certificateOfRegistration.registrationDate && (
                            <div className="flex items-center">
                              <span className="text-xs text-blue-500 font-medium w-36">Registration Date:</span>
                              <span className="text-sm font-medium">{extractedDocumentData.certificateOfRegistration.registrationDate}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            </div>
          )}

          {/* Enterprise Account Requirements */}
          {accountType === 'enterprise' && (
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Building2 className="h-5 w-5 text-slate-500 mr-2" />
                <h3 className="text-lg font-medium">Enterprise Account Requirements</h3>
              </div>

              {/* SCUML Section - First Priority */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">1</span>
                  Securities License Information
                </h4>
                <div className="space-y-4">
                  <SCUMLToggle
                    checked={hasSCUMLLicense}
                    onChange={handleSCUMLToggle}
                  />
                  {hasSCUMLLicense && (
                    <SCUMLInput
                      value={scumlNumber}
                      onChange={handleSCUMLChange}
                      error={scumlError}
                    />
                  )}
                </div>
              </div>

              {/* TIN and CAC Validation Section */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">2</span>
                  Business Registration Validation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tax Identification Number (TIN)
                    </label>
                    <input
                      type="text"
                      name="taxNumber"
                      value={taxInfo.taxNumber}
                      placeholder="Enter TIN"
                      onChange={handleTaxInfoChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white/50 backdrop-blur-sm"
                    />
                    {tinValidationError && (
                      <p className="mt-1 text-sm text-red-600">{tinValidationError}</p>
                    )}
                    {tinValidationResult && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">✓ TIN Validated</p>
                        <p className="text-xs text-green-700">{tinValidationResult.taxpayer_name || tinValidationResult.search}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      CAC RC Number
                    </label>
                    <input
                      type="text"
                      name="rcNumber"
                      value={rcNumber}
                      placeholder="Enter RC Number"
                      onChange={e => setRcNumber(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white/50 backdrop-blur-sm"
                    />
                    {cacValidationError && (
                      <p className="mt-1 text-sm text-red-600">{cacValidationError}</p>
                    )}
                    {cacValidationResult && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">✓ CAC Validated</p>
                        <p className="text-xs text-green-700">{cacValidationResult.company_name}</p>
                        <p className="text-xs text-green-700">{cacValidationResult.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Show other fields only if no SCUML license */}
              <>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                  <FileUploadBox
                    docType="certificateOfRegistration"
                    label="Certificate of Registration (Original to be sighted)"
                    accountTypeKey="enterprise"
                    fileRef={fileInputRefs.certificateOfRegistration}
                  />

                  <FileUploadBox
                    docType="formOfApplication"
                    label="Form of Application for Registration (Certified by CAC)"
                    accountTypeKey="enterprise"
                    fileRef={fileInputRefs.formOfApplication}
                  />

                  <FileUploadBox
                    docType="passportPhotos"
                    label="Two recent passport-size photographs of each owner"
                    accountTypeKey="enterprise"
                    fileRef={fileInputRefs.passportPhotos}
                  />

                  <FileUploadBox
                    docType="utilityReceipt"
                    label="Photocopy of Public Utility Receipt (Original sighted)"
                    accountTypeKey="enterprise"
                    fileRef={fileInputRefs.utilityReceipt}
                  />

                  <div className="md:col-span-2">
                    <FileUploadBox
                      docType="businessOwnerID"
                      label="Valid Identification of Business Owner"
                      accountTypeKey="enterprise"
                      fileRef={fileInputRefs.businessOwnerID}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <TextInput
                    label="Company's Operating Business Address"
                    name="businessAddress"
                    value={businessAddress}
                    placeholder="Full business address"
                    onChange={(e) => setBusinessAddress(e.target.value)}
                  />
                </div>

                <div className="mt-8">
                  <h4 className="text-lg font-medium mb-4">Corporate References (Two independent references required)</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                    <div className="p-6 border border-slate-200 rounded-lg">
                      <h5 className="font-medium mb-4">Reference 1</h5>
                      <div className="space-y-4">
                        <TextInput
                          label="Name"
                          name="ref1Name"
                          value={references.ref1Name}
                          placeholder="Company/Individual Name"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Address"
                          name="ref1Address"
                          value={references.ref1Address}
                          placeholder="Full Address"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Phone Number"
                          name="ref1Phone"
                          value={references.ref1Phone}
                          placeholder="Contact Number"
                          onChange={handleReferenceChange}
                        />
                      </div>
                    </div>

                    <div className="p-6 border border-slate-200 rounded-lg">
                      <h5 className="font-medium mb-4">Reference 2</h5>
                      <div className="space-y-4">
                        <TextInput
                          label="Name"
                          name="ref2Name"
                          value={references.ref2Name}
                          placeholder="Company/Individual Name"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Address"
                          name="ref2Address"
                          value={references.ref2Address}
                          placeholder="Full Address"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Phone Number"
                          name="ref2Phone"
                          value={references.ref2Phone}
                          placeholder="Contact Number"
                          onChange={handleReferenceChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            </div>
          )}

          {/* Limited Liability Account Requirements */}
          {accountType === 'llc' && (
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <FileText className="h-5 w-5 text-slate-500 mr-2" />
                <h3 className="text-lg font-medium">Limited Liability Account Requirements</h3>
              </div>

              {/* SCUML Section - First Priority */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">1</span>
                  Securities License Information
                </h4>
                <div className="space-y-4">
                  <SCUMLToggle
                    checked={hasSCUMLLicense}
                    onChange={handleSCUMLToggle}
                  />
                  {hasSCUMLLicense && (
                    <SCUMLInput
                      value={scumlNumber}
                      onChange={handleSCUMLChange}
                      error={scumlError}
                    />
                  )}
                </div>
              </div>

              {/* TIN and CAC Validation Section */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">2</span>
                  Business Registration Validation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tax Identification Number (TIN)
                    </label>
                    <input
                      type="text"
                      name="taxNumber"
                      value={taxInfo.taxNumber}
                      placeholder="Enter TIN"
                      onChange={handleTaxInfoChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white/50 backdrop-blur-sm"
                    />
                    {tinValidationError && (
                      <p className="mt-1 text-sm text-red-600">{tinValidationError}</p>
                    )}
                    {tinValidationResult && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">✓ TIN Validated</p>
                        <p className="text-xs text-green-700">{tinValidationResult.taxpayer_name || tinValidationResult.search}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      CAC RC Number
                    </label>
                    <input
                      type="text"
                      name="rcNumber"
                      value={rcNumber}
                      placeholder="Enter RC Number"
                      onChange={e => setRcNumber(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white/50 backdrop-blur-sm"
                    />
                    {cacValidationError && (
                      <p className="mt-1 text-sm text-red-600">{cacValidationError}</p>
                    )}
                    {cacValidationResult && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">✓ CAC Validated</p>
                        <p className="text-xs text-green-700">{cacValidationResult.company_name}</p>
                        <p className="text-xs text-green-700">{cacValidationResult.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Show other fields only if no SCUML license */}
              <>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                  <FileUploadBox
                    docType="certificateOfIncorporation"
                    label="Certificate of Incorporation / Registration Number"
                    accountTypeKey="llc"
                    fileRef={fileInputRefs.certificateOfIncorporation}
                  />

                  <FileUploadBox
                    docType="memorandumArticles"
                    label="Memorandum and Articles of Association"
                    accountTypeKey="llc"
                    fileRef={fileInputRefs.memorandumArticles}
                  />

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6  pb-6">
                    <TextInput
                      label="Tax Identification Number (TIN)"
                      name="taxNumber"
                      value={taxInfo.taxNumber}
                      placeholder="Enter TIN"
                      onChange={handleTaxInfoChange}
                    />

                    <TextInput
                      label="SCUML Registration Number (if applicable)"
                      name="scumlNumber"
                      value={taxInfo.scumlNumber}
                      placeholder="Enter SCUML Number"
                      onChange={handleTaxInfoChange}
                    />
                  </div>

                  <FileUploadBox
                    docType="boardResolution"
                    label="Board Resolution authorizing the account opening"
                    accountTypeKey="llc"
                    fileRef={fileInputRefs.boardResolution}
                  />

                  <FileUploadBox
                    docType="directorsID"
                    label="Valid Identification of Directors and Signatories"
                    accountTypeKey="llc"
                    fileRef={fileInputRefs.directorsID}
                  />


                  <div className="md:col-span-2">
                    <FileUploadBox
                      docType="proofOfAddress"
                      label="Proof of Address (Utility Bill, Bank Statement, etc.)"
                      accountTypeKey="llc"
                      fileRef={fileInputRefs.proofOfAddress}
                    />
                  </div>

                </div>
                <div className="mt-6">
                  <TextInput
                    label="Company's Operating Business Address"
                    name="businessAddress"
                    value={businessAddress}
                    placeholder="Full business address"
                    onChange={(e) => setBusinessAddress(e.target.value)}
                  />
                </div>

                <div className="mt-8">
                  <h4 className="text-lg font-medium mb-4">Corporate References (Two independent references required)</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                    <div className="p-6 border border-slate-200 rounded-lg">
                      <h5 className="font-medium mb-4">Reference 1</h5>
                      <div className="space-y-4">
                        <TextInput
                          label="Name"
                          name="ref1Name"
                          value={references.ref1Name}
                          placeholder="Company/Individual Name"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Address"
                          name="ref1Address"
                          value={references.ref1Address}
                          placeholder="Full Address"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Phone Number"
                          name="ref1Phone"
                          value={references.ref1Phone}
                          placeholder="Contact Number"
                          onChange={handleReferenceChange}
                        />
                      </div>
                    </div>

                    <div className="p-6 border border-slate-200 rounded-lg">
                      <h5 className="font-medium mb-4">Reference 2</h5>
                      <div className="space-y-4">
                        <TextInput
                          label="Name"
                          name="ref2Name"
                          value={references.ref2Name}
                          placeholder="Company/Individual Name"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Address"
                          name="ref2Address"
                          value={references.ref2Address}
                          placeholder="Full Address"
                          onChange={handleReferenceChange}
                        />
                        <TextInput
                          label="Phone Number"
                          name="ref2Phone"
                          value={references.ref2Phone}
                          placeholder="Contact Number"
                          onChange={handleReferenceChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            </div>
          )}
          {/* {error && (
            <div className="mb-6 p-5 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm animate-fadeIn">
              <div className="flex items-start">
                <AlertCircle className="h-6 w-6 text-red-600 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-semibold text-red-800">There was a problem with your submission</h4>
                  <p className="text-sm text-red-700 mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          )} */}

          <div className="mt-8 flex flex-col items-center">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (
                  (['partnership', 'enterprise', 'llc'].includes(accountType) && hasSCUMLLicense)
                    ? (!scumlNumber || !!scumlError)
                    : !getRequiredDocumentsForAccountType(accountType).every(docType => getFileByType(accountType, docType) !== null)
                )
              }
              className={`w-full max-w-md py-4 px-6 ${isSubmitting ||
                  (
                    (['partnership', 'enterprise', 'llc'].includes(accountType) && hasSCUMLLicense)
                      ? (!scumlNumber || !!scumlError)
                      : !getRequiredDocumentsForAccountType(accountType).every(docType => getFileByType(accountType, docType) !== null)
                  )
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                } text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg shadow-blue-500/20 ${!isSubmitting &&
                  (
                    (['partnership', 'enterprise', 'llc'].includes(accountType) && hasSCUMLLicense)
                      ? (scumlNumber && !scumlError)
                      : getRequiredDocumentsForAccountType(accountType).every(docType => getFileByType(accountType, docType) !== null)
                  )
                  ? 'hover:shadow-blue-500/30 hover:scale-[1.01] hover:-translate-y-0.5'
                  : ''
                }`}
            >
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin mr-3"></div>
                  <span className="">Processing Submission...</span>
                </>
              ) : 'Submit Documents'}
            </button>

            <p className="text-xs text-slate-500 mt-4 text-center">
              By submitting, you confirm that all documents provided are authentic and valid.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadKYCDocumentsPage;
