'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Building, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import BusinessValidationDisplay from '@/components/user/BusinessValidationDisplay';

const BusinessValidationTestPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    tin: '',
    rcNumber: '',
    companyType: 'COMPANY'
  });

  // Check if user is authenticated
  if (!loading && !user) {
    router.push('/access');
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    setError(null);
    setValidationResult(null);

    try {
      const response = await fetch('/api/user/business-validation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tin: formData.tin || undefined,
          rcNumber: formData.rcNumber || undefined,
          companyType: formData.rcNumber ? formData.companyType : undefined,
          saveToDatabase: true
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Validation failed');
      }

      setValidationResult(data);
    } catch (err) {
      console.error('Validation error:', err);
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

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
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Business Validation Test
          </h1>
          <p className="text-gray-600">
            Test CAC RC Number and Tax Identification Number (TIN) validation with Dojah APIs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Validation Form */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Validate Business Information
            </h2>

            <form onSubmit={handleValidation} className="space-y-4">
              {/* TIN Input */}
              <div>
                <label htmlFor="tin" className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Identification Number (TIN)
                </label>
                <input
                  type="text"
                  id="tin"
                  name="tin"
                  value={formData.tin}
                  onChange={handleInputChange}
                  placeholder="Enter TIN number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Enter TIN for validation
                </p>
              </div>

              {/* RC Number Input */}
              <div>
                <label htmlFor="rcNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  CAC RC Number
                </label>
                <input
                  type="text"
                  id="rcNumber"
                  name="rcNumber"
                  value={formData.rcNumber}
                  onChange={handleInputChange}
                  placeholder="Enter RC number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required if validating CAC information
                </p>
              </div>

              {/* Company Type */}
              <div>
                <label htmlFor="companyType" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Type
                </label>
                <select
                  id="companyType"
                  name="companyType"
                  value={formData.companyType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="COMPANY">Company</option>
                  <option value="BUSINESS_NAME">Business Name</option>
                  <option value="INCORPORATED_TRUSTEES">Incorporated Trustees</option>
                  <option value="LIMITED_PARTNERSHIP">Limited Partnership</option>
                  <option value="LIMITED_LIABILITY_PARTNERSHIP">Limited Liability Partnership</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Required if validating CAC information
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isValidating || (!formData.tin && !formData.rcNumber)}
                className={`w-full py-2 px-4 rounded-md font-medium ${
                  isValidating || (!formData.tin && !formData.rcNumber)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isValidating ? 'Validating...' : 'Validate Business Information'}
              </button>
            </form>

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
                  <div>
                    <p className="text-red-800 font-medium">Validation Error</p>
                    <p className="text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Display */}
          <div className="space-y-6">
            {/* Current Validation Status */}
            <BusinessValidationDisplay 
              darkMode={false} 
              userId={user?.id || ''} 
            />

            {/* Latest Validation Result */}
            {validationResult && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Latest Validation Result
                </h3>

                <div className="space-y-4">
                  {/* Overall Status */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Overall Status</span>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(
                        validationResult.validation.overallStatus, 
                        validationResult.validation.overallStatus === 'APPROVED'
                      )}
                      <span className="font-medium">
                        {validationResult.validation.overallStatus === 'APPROVED' ? 'Approved' :
                         validationResult.validation.overallStatus === 'REQUIRES_MANUAL_REVIEW' ? 'Requires Review' :
                         validationResult.validation.overallStatus}
                      </span>
                    </div>
                  </div>

                  {/* Validation Score */}
                  {validationResult.validation.validationScore > 0 && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Validation Score</span>
                        <span className="font-medium">{validationResult.validation.validationScore}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            validationResult.validation.validationScore >= 100 ? 'bg-green-600' : 
                            validationResult.validation.validationScore >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                          } rounded-full transition-all duration-500`}
                          style={{ width: `${validationResult.validation.validationScore}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* TIN Validation */}
                  {validationResult.validation.tinValidation && (
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-gray-600" />
                          <span className="font-medium">TIN Validation</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(
                            validationResult.validation.tinValidation.status,
                            validationResult.validation.tinValidation.isValid
                          )}
                          <span className="text-sm">
                            {validationResult.validation.tinValidation.status}
                          </span>
                        </div>
                      </div>
                      {validationResult.validation.tinValidation.error && (
                        <p className="text-sm text-red-600">
                          {validationResult.validation.tinValidation.error}
                        </p>
                      )}
                    </div>
                  )}

                  {/* CAC Validation */}
                  {validationResult.validation.cacValidation && (
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4 text-gray-600" />
                          <span className="font-medium">CAC Validation</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(
                            validationResult.validation.cacValidation.status,
                            validationResult.validation.cacValidation.isValid
                          )}
                          <span className="text-sm">
                            {validationResult.validation.cacValidation.status}
                          </span>
                        </div>
                      </div>
                      {validationResult.validation.cacValidation.error && (
                        <p className="text-sm text-red-600">
                          {validationResult.validation.cacValidation.error}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Manual Review Notice */}
                  {validationResult.validation.requiresManualReview && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-800">
                            Manual Review Required
                          </h4>
                          <p className="text-sm text-amber-700 mt-1">
                            {validationResult.validation.manualReviewReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800">{validationResult.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessValidationTestPage; 