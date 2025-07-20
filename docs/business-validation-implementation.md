# Business Validation Implementation

## Overview

This implementation adds CAC RC Number and Tax Identification Number (TIN) validation to the digital onboarding platform using Dojah APIs. The system includes robust error handling, fallback mechanisms, and **comprehensive database storage** to ensure all files and field data are properly stored, even when APIs fail or return errors.

## Key Features

### 1. **Comprehensive Database Storage**
- **All validation attempts are stored** in the database regardless of success/failure
- **File metadata is stored** for uploaded documents
- **Complete audit trail** of all validation activities
- **API responses are preserved** for debugging and analysis
- **Validation history** is maintained for each user

### 2. **Robust Error Handling**
- API failures don't prevent data from being saved
- All validation attempts are logged with detailed error information
- Graceful degradation when external services are unavailable

### 3. **Manual Review System**
- Failed validations are flagged for manual admin review
- Admins can approve or reject validations manually
- Complete audit trail of all validation decisions

### 4. **Multiple Validation Statuses**
- `SUCCESS`: Validation passed
- `FAILED`: Validation failed (data not found)
- `ERROR`: API error occurred
- `PENDING`: Awaiting validation

## Database Storage Details

### 1. **DojahVerification Table**
Every validation attempt is stored with:
```typescript
{
  userId: string,
  verificationType: 'TIN_VALIDATION' | 'CAC_VALIDATION',
  requestData: {
    tin?: string,
    rcNumber?: string,
    companyType?: string,
    timestamp: string,
    additionalData?: any
  },
  responseData: {
    // Full API response or error details
  },
  status: 'PENDING' | 'SUCCESS' | 'FAILED',
  confidence?: number,
  extractedData?: any,
  errorMessage?: string
}
```

### 2. **KYCFormData Table**
Business validation results are stored with:
```typescript
{
  userId: string,
  tinValidationResult: {
    isValid: boolean,
    status: string,
    data?: any,
    error?: string,
    timestamp: Date,
    validationId?: string
  },
  cacValidationResult: {
    isValid: boolean,
    status: string,
    data?: any,
    error?: string,
    timestamp: Date,
    validationId?: string
  },
  rcNumber?: string,
  companyType?: string,
  businessName?: string,
  businessAddress?: string,
  taxNumber?: string,
  extractedData?: {
    validationTimestamp: string,
    validationScore: number,
    overallStatus: string,
    requiresManualReview: boolean,
    manualReviewReason?: string
  }
}
```

### 3. **KYCDocument Table**
File metadata is stored for uploaded documents:
```typescript
{
  userId: string,
  type: string, // Document type
  fileName: string,
  fileSize: number,
  mimeType: string,
  fileUrl: string, // S3 URL
  s3Key: string, // S3 key
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
  notes: string // e.g., "Uploaded for TIN validation"
}
```

### 4. **AuditLog Table**
Complete audit trail of all activities:
```typescript
{
  userId: string,
  action: string, // e.g., 'BUSINESS_VALIDATION_STORED', 'VALIDATION_FILES_UPLOADED'
  details: string, // JSON string with detailed information
  timestamp: Date
}
```

## Implementation Components

### 1. Enhanced Business Validation Service (`lib/business-validation-service.ts`)

**Key Methods:**
- `validateTIN(tin: string, userId: string, additionalData?)`: Validates TIN and stores in database
- `validateCAC(rcNumber: string, companyType: CacCompanyType, userId: string, additionalData?)`: Validates CAC and stores in database
- `validateBusinessWithStorage(request: ValidationRequest)`: Comprehensive validation with full storage
- `storeValidationFiles(userId: string, files, validationType)`: Stores file metadata
- `storeBusinessValidationData(userId: string, validationResult, requestData)`: Stores validation results
- `getValidationHistory(userId: string)`: Retrieves validation history

**Database Storage Flow:**
```typescript
// 1. Store initial validation attempt
const validationRecord = await prisma.dojahVerification.create({
  data: {
    userId,
    verificationType: 'TIN_VALIDATION' as any,
    requestData: { tin, timestamp, additionalData },
    responseData: { status: 'PENDING' },
    status: 'PENDING'
  }
});

// 2. Perform API validation
const result = await dojahService.lookupFirsTin(tin);

// 3. Update with results
await prisma.dojahVerification.update({
  where: { id: validationRecord.id },
  data: {
    responseData: result as any,
    status: 'SUCCESS',
    confidence: 100,
    extractedData: result as any
  }
});
```

### 2. Enhanced KYC Form Data API (`app/api/user/kyc-form-data/route.ts`)

**New Features:**
- Uses `validateBusinessWithStorage()` for comprehensive validation
- Stores all business data including files
- Maintains complete audit trail
- Handles validation errors gracefully

**Usage:**
```javascript
const response = await fetch('/api/user/kyc-form-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountType: 'ENTERPRISE',
    businessName: 'My Company Ltd',
    tin: '1234567890',
    rcNumber: 'RC123456',
    companyType: 'COMPANY',
    performBusinessValidation: true,
    additionalData: {
      // Any additional business information
    },
    isSubmitted: true
  })
});
```

### 3. Enhanced Business Validation API (`app/api/user/business-validation/route.ts`)

**Features:**
- Comprehensive validation with full database storage
- File upload support
- Validation history retrieval
- Real-time status updates

**Usage:**
```javascript
const response = await fetch('/api/user/business-validation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tin: '1234567890',
    rcNumber: 'RC123456',
    companyType: 'COMPANY',
    businessName: 'My Company Ltd',
    businessAddress: '123 Business St',
    taxNumber: 'TAX123456',
    additionalData: {
      // Additional business information
    }
  })
});
```

### 4. Admin Review System (`app/api/admin/business-validation/route.ts`)

**Admin Capabilities:**
- View all validations requiring manual review
- Approve or reject individual validations
- Add review notes and reasoning
- Update user verification status
- Access complete validation history

## File Storage Implementation

### 1. **File Upload Process**
```typescript
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
```

### 2. **File Types Supported**
- TIN documents
- CAC registration documents
- Business registration certificates
- Tax certificates
- Any additional business documents

### 3. **File Storage Flow**
1. File metadata stored in `KYCDocument` table
2. File uploaded to S3 (if configured)
3. S3 URL and key updated in database
4. File linked to validation records
5. Audit log created for file upload

## Data Retrieval and History

### 1. **Validation History**
```typescript
const history = await BusinessValidationService.getValidationHistory(userId);
// Returns all TIN and CAC validations for the user
```

### 2. **Current Validation Status**
```typescript
const response = await fetch('/api/user/business-validation');
// Returns current validation status and business information
```

### 3. **Admin Dashboard Data**
```typescript
const response = await fetch('/api/admin/business-validation?status=error');
// Returns validations requiring manual review
```

## Error Handling and Data Persistence

### 1. **API Failures**
- Validation attempt is still stored in database
- Error details are preserved
- Status is set to 'FAILED' with error message
- Manual review is triggered

### 2. **Network Issues**
- Timeout handling with retry logic
- Fallback to manual review process
- Data is never lost due to network issues

### 3. **Invalid Data**
- Invalid data is stored with failure status
- Clear error messages are provided
- Manual review allows for data correction

## Audit Trail and Compliance

### 1. **Complete Audit Log**
Every action is logged with:
- Timestamp
- User ID
- Action type
- Detailed information
- Related validation IDs

### 2. **Compliance Features**
- All validation attempts are preserved
- API responses are stored for audit
- Admin decisions are tracked
- File uploads are logged

### 3. **Data Retention**
- Validation history is maintained indefinitely
- File metadata is preserved
- Audit logs are kept for compliance

## Testing and Validation

### 1. **Test Page**
Visit `/user/business-validation-test` to test:
- TIN validation
- CAC validation
- File uploads
- Error handling
- Database storage

### 2. **API Testing**
```bash
# Test TIN validation
curl -X POST /api/user/business-validation \
  -H "Content-Type: application/json" \
  -d '{"tin": "1234567890"}'

# Test CAC validation
curl -X POST /api/user/business-validation \
  -H "Content-Type: application/json" \
  -d '{"rcNumber": "RC123456", "companyType": "COMPANY"}'
```

### 3. **Database Verification**
```sql
-- Check validation history
SELECT * FROM "DojahVerification" 
WHERE "userId" = 'user123' 
AND "verificationType" IN ('TIN_VALIDATION', 'CAC_VALIDATION');

-- Check file uploads
SELECT * FROM "KYCDocument" 
WHERE "userId" = 'user123' 
AND "notes" LIKE '%validation%';

-- Check audit logs
SELECT * FROM "AuditLog" 
WHERE "userId" = 'user123' 
AND "action" LIKE '%VALIDATION%';
```

## Security and Data Protection

### 1. **Data Encryption**
- Sensitive data is encrypted in transit
- Database connections use SSL
- File uploads are secured

### 2. **Access Control**
- User authentication required
- Admin role verification
- Audit trail for all actions

### 3. **Data Validation**
- Input validation on all fields
- SQL injection protection
- XSS prevention

## Performance Considerations

### 1. **Database Optimization**
- Indexed queries for validation history
- Efficient pagination for large datasets
- Optimized joins for related data

### 2. **API Performance**
- Caching for frequently accessed data
- Asynchronous processing for file uploads
- Rate limiting to prevent abuse

### 3. **Storage Efficiency**
- Compressed file storage
- Efficient JSON storage for validation data
- Regular cleanup of temporary data

## Conclusion

This enhanced implementation ensures that **all files and field data are comprehensively stored in the database**, providing:

1. **Complete Data Persistence**: No data is lost, even when APIs fail
2. **Full Audit Trail**: Every action is logged and traceable
3. **File Management**: All uploaded files are properly stored and tracked
4. **Error Recovery**: Failed validations can be reviewed and corrected manually
5. **Compliance Ready**: Complete audit trail for regulatory requirements

The system provides a robust, scalable solution for business validation with comprehensive error handling, manual review capabilities, and complete data storage that ensures no information is ever lost. 