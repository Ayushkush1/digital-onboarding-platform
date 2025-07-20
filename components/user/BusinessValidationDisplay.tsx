// components/user/BusinessValidationDisplay.tsx
import React, { useState, useEffect } from 'react';
import { 
  Building, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { BusinessValidationService } from '@/lib/business-validation-service';

interface BusinessValidationDisplayProps {
  darkMode?: boolean;
  userId: string;
}

interface ValidationData {
  tinValidation: any;
  cacValidation: any;
  overallStatus: string;
  validationScore: number;
  requiresManualReview: boolean;
  manualReviewReason?: string;
  lastUpdated?: string;
}

const BusinessValidationDisplay: React.FC<BusinessValidationDisplayProps> = ({ 
  darkMode = false, 
  userId 
}) => {
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchValidationData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/business-validation');
      if (!response.ok) {
        throw new Error('Failed to fetch validation data');
      }

      const data = await response.json();
      if (data.success && data.validation) {
        setValidationData(data.validation);
      } else {
        setValidationData(null);
      }
    } catch (err) {
      console.error('Error fetching business validation data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load validation data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchValidationData();
  }, [userId]);

  const getStatusIcon = (status: string, isValid: boolean) => {
    switch (status) {
      case 'SUCCESS':
        return isValid ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        );
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-yellow-600" />;
      case 'ERROR':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-gray-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string, isValid: boolean) => {
    switch (status) {
      case 'SUCCESS':
        return isValid ? 'text-green-600' : 'text-red-600';
      case 'FAILED':
        return 'text-yellow-600';
      case 'ERROR':
        return 'text-orange-600';
      case 'PENDING':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBgColor = (status: string, isValid: boolean) => {
    switch (status) {
      case 'SUCCESS':
        return isValid ? 'bg-green-50' : 'bg-red-50';
      case 'FAILED':
        return 'bg-yellow-50';
      case 'ERROR':
        return 'bg-orange-50';
      case 'PENDING':
        return 'bg-gray-50';
      default:
        return 'bg-gray-50';
    }
  };

  const getStatusBorderColor = (status: string, isValid: boolean) => {
    switch (status) {
      case 'SUCCESS':
        return isValid ? 'border-green-200' : 'border-red-200';
      case 'FAILED':
        return 'border-yellow-200';
      case 'ERROR':
        return 'border-orange-200';
      case 'PENDING':
        return 'border-gray-200';
      default:
        return 'border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 shadow-sm`}>
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
          <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Loading business validation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 shadow-sm`}>
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Error loading validation data: {error}</span>
        </div>
        <button
          onClick={fetchValidationData}
          className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!validationData) {
    return null; // Don't show anything if no validation data
  }

  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Building className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Business Validation
          </h3>
        </div>
        <button
          onClick={fetchValidationData}
          className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          title="Refresh validation data"
        >
          <RefreshCw className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Overall Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Overall Status
          </span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(validationData.overallStatus, validationData.overallStatus === 'APPROVED')}
            <span className={`font-medium ${getStatusColor(validationData.overallStatus, validationData.overallStatus === 'APPROVED')}`}>
              {validationData.overallStatus === 'APPROVED' ? 'Approved' :
               validationData.overallStatus === 'REQUIRES_MANUAL_REVIEW' ? 'Requires Review' :
               validationData.overallStatus}
            </span>
          </div>
        </div>
        
        {validationData.validationScore > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-sm mb-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Validation Score</span>
              <span className="font-medium">{validationData.validationScore}%</span>
            </div>
            <div className={`h-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden`}>
              <div
                className={`h-full ${validationData.validationScore >= 100 ? 'bg-green-600' : 
                  validationData.validationScore >= 50 ? 'bg-yellow-600' : 'bg-red-600'} rounded-full transition-all duration-500`}
                style={{ width: `${validationData.validationScore}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TIN Validation */}
      {validationData.tinValidation && (
        <div className={`mb-4 p-4 rounded-lg border ${getStatusBgColor(validationData.tinValidation.status, validationData.tinValidation.isValid)} ${getStatusBorderColor(validationData.tinValidation.status, validationData.tinValidation.isValid)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-600" />
              <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tax Identification Number (TIN)</span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(validationData.tinValidation.status, validationData.tinValidation.isValid)}
              <span className={`text-sm font-medium ${getStatusColor(validationData.tinValidation.status, validationData.tinValidation.isValid)}`}>
                {BusinessValidationService.getValidationStatusDisplay(validationData.tinValidation)}
              </span>
            </div>
          </div>
          
          {validationData.tinValidation.error && (
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {validationData.tinValidation.error}
            </p>
          )}
          
          {validationData.tinValidation.data && (
            <div className={`mt-2 p-3 ${darkMode ? 'bg-gray-700' : 'bg-white'} rounded border`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Taxpayer Name:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.tinValidation.data.taxpayer_name}
                  </span>
                </div>
                <div>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>TIN:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.tinValidation.data.firstin}
                  </span>
                </div>
                <div>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Tax Office:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.tinValidation.data.tax_office}
                  </span>
                </div>
                <div>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Phone:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.tinValidation.data.phone_number}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CAC Validation */}
      {validationData.cacValidation && (
        <div className={`mb-4 p-4 rounded-lg border ${getStatusBgColor(validationData.cacValidation.status, validationData.cacValidation.isValid)} ${getStatusBorderColor(validationData.cacValidation.status, validationData.cacValidation.isValid)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4 text-gray-600" />
              <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Corporate Affairs Commission (CAC)</span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(validationData.cacValidation.status, validationData.cacValidation.isValid)}
              <span className={`text-sm font-medium ${getStatusColor(validationData.cacValidation.status, validationData.cacValidation.isValid)}`}>
                {BusinessValidationService.getValidationStatusDisplay(validationData.cacValidation)}
              </span>
            </div>
          </div>
          
          {validationData.cacValidation.error && (
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {validationData.cacValidation.error}
            </p>
          )}
          
          {validationData.cacValidation.data && (
            <div className={`mt-2 p-3 ${darkMode ? 'bg-gray-700' : 'bg-white'} rounded border`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Company Name:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.cacValidation.data.company_name}
                  </span>
                </div>
                <div>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>RC Number:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.cacValidation.data.rc_number}
                  </span>
                </div>
                <div>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Company Type:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.cacValidation.data.type_of_company}
                  </span>
                </div>
                <div>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Status:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.cacValidation.data.status}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Address:</span>
                  <span className={`ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {validationData.cacValidation.data.address}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Review Notice */}
      {validationData.requiresManualReview && (
        <div className={`p-4 rounded-lg border ${darkMode ? 'bg-amber-900/20 border-amber-600/30' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start space-x-2">
            <AlertCircle className={`h-5 w-5 ${darkMode ? 'text-amber-400' : 'text-amber-500'} mt-0.5`} />
            <div>
              <h4 className={`font-medium ${darkMode ? 'text-amber-100' : 'text-amber-800'}`}>
                Manual Review Required
              </h4>
              <p className={`text-sm mt-1 ${darkMode ? 'text-amber-200' : 'text-amber-700'}`}>
                {validationData.manualReviewReason || 'Your business validation requires manual review by our team.'}
              </p>
              <p className={`text-xs mt-2 ${darkMode ? 'text-amber-300' : 'text-amber-600'}`}>
                This process typically takes 1-2 business days. You will be notified once the review is complete.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {validationData.lastUpdated && (
        <div className={`mt-4 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Last updated: {new Date(validationData.lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default BusinessValidationDisplay; 