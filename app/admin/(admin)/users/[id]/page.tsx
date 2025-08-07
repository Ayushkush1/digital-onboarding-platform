'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  History,
  Download,
  Eye
} from 'lucide-react';
import DojahVerificationDisplay from '@/components/admin/DojahVerificationDisplay';
import RejectDocumentModal from '@/components/admin/RejectDocumentModal';
import { useHeader } from '../../hooks';

interface UserDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  accountType: string;
  accountStatus: string;
  createdAt: string;
  scumlNumber?: string; // Add SCUML license number
  tinNumber?: string; // Add TIN number
  rcNumber?: string; // Add RC number
  cacCompanyData?: any; // Add CAC validation data
  businessName?: string; // Add business name
  businessAddress?: string; // Add business address
  verificationStatus: {
    overallStatus: string;
    kycStatus: string;
    selfieStatus: string;
    progress: number;
  };
  selfieVerification?: {
    id: string;
    status: string;
    fileUrl: string;
    capturedAt: string;
    fileName: string;

  };
  documents: Array<{
    id: string;
    type: string;
    fileName: string;
    uploadedAt: string;
    status: string;
    fileSize: number;
    mimeType: string;
    notes?: string;
    documentAnalysis?: any;
    dojahVerification?: any;
  }>;
  documentDetails: any;
  dojahVerifications: {
    total: number;
    governmentVerifications: Array<any>;
    amlScreenings: Array<any>;
  };
  adminReviews: Array<{
    id: string;
    verificationType: string;
    status: string;
    reviewNotes?: string;
    rejectionReason?: string;
    allowReupload: boolean;
    reviewer: {
      firstName: string;
      lastName: string;
    };
    createdAt: string;
  }>;
  canReupload: boolean;
}

export default function UserDetailsPage() {
  const { id: userId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [documentReviewNotes, setDocumentReviewNotes] = useState<{ [key: string]: string }>({}); const [expandedDocuments, setExpandedDocuments] = useState<{ [key: string]: boolean }>({});
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [currentRejectDocId, setCurrentRejectDocId] = useState<string | null>(null);
  const [currentDocType, setCurrentDocType] = useState<string>('');
  const { updateHeader } = useHeader();

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  useEffect(() => {
    if (userDetails) {
      updateHeader(
        `User: ${userDetails.firstName} ${userDetails.lastName}`,
        `User profile and verification details`
      );
    } else {
      updateHeader('User Details', 'Loading user information...');
    }
  }, [userDetails, updateHeader]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users/${userId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }

      const data = await response.json();
      console.log('vishal', data);
      setUserDetails(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const [reviewMessage, setReviewMessage] = React.useState<string | null>(null);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const handleReview = async (
    documentId: string,
    status: string,
    notes: string,
    rejectionReason?: string,
    allowReupload?: boolean
  ) => {
    try {
      setIsReviewing(true);
      setReviewMessage(null);
      setReviewError(null);

      const document = userDetails?.documents.find(d => d.id === documentId);
      const verificationType = document?.type === 'PASSPORT_PHOTOS' ?
        'SELFIE_VERIFICATION' : 'DOCUMENT_VERIFICATION';

      const dojahVerificationId = document?.dojahVerification?.id;

      // Get the review notes from the state or use the provided notes
      const reviewNotes = documentReviewNotes[documentId] || notes;

      const response = await fetch('/api/admin/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userDetails?.id,
          documentId,
          verificationType,
          dojahVerificationId,
          status,
          reviewNotes: reviewNotes,
          rejectionReason,
          allowReupload: allowReupload || false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit review');
      }

      // Refresh user details to show updated status
      await fetchUserDetails();

      // Show success message
      setReviewMessage(`Document ${status.toLowerCase()} successfully!`);

      // Reset the form
      setDocumentReviewNotes({
        ...documentReviewNotes,
        [documentId]: ''
      });

    } catch (error: any) {
      setReviewError(`Error submitting review: ${error.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleOpenRejectModal = (docId: string, docType: string) => {
    setCurrentRejectDocId(docId);
    setCurrentDocType(docType);
    setRejectModalOpen(true);
  };

  const handleRejectWithModal = (documentId: string, reason: string, allowReupload: boolean) => {
    // Close the modal
    setRejectModalOpen(false);
    setCurrentRejectDocId(null);

    // Call the handleReview function with the rejection parameters
    handleReview(documentId, "REJECTED", reason, reason, allowReupload);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'REJECTED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'IN_PROGRESS':
        return <AlertTriangle className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const downloadDocument = async (docId: string, docFileName: string) => {
    try {
      // Use the correct endpoint format with userId and documentId
      const response = await fetch(`/api/admin/submissions/${userId}/download?documentId=${docId}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      setError('Failed to download document');
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !userDetails) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg">{error || 'User not found'}</div>
      </div>
    );
  }
  return (
    <div className="relative max-w-7xl mx-auto">
      {/* User status badge */}
      <div className="md:absolute right-0 top-2 flex justify-center md:justify-end">
        <div className="flex items-center space-x-2">
          {getStatusIcon(userDetails.verificationStatus.overallStatus)}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(userDetails.verificationStatus.overallStatus)}`}>
            {userDetails.scumlNumber ? 'APPROVED (SCUML)' : userDetails.verificationStatus.overallStatus}
          </span>
        </div>
      </div>


      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'documents', label: 'Documents & Verification', icon: FileText },
            { id: 'history', label: 'Review History', icon: History }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Icon className="h-5 w-5 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Display review success or error messages */}
      {reviewMessage && (
        <div className="mb-4 p-4 bg-green-100 text-green-800 rounded">
          {reviewMessage}
        </div>
      )}
      {reviewError && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">
          {reviewError}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Information */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
              <div className="grid grid-cols gap-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{userDetails.email}</p>
                  </div>
                </div>

                {userDetails.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{userDetails.phone}</p>
                    </div>
                  </div>
                )}

                {userDetails.address && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-medium">{userDetails.address}</p>
                    </div>
                  </div>
                )}


                {userDetails.dateOfBirth && (
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Date of Birth</p>
                      <p className="font-medium">{userDetails.dateOfBirth}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>


            {/* Account Information */}
            <div className="bg-white rounded-lg border p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Account Type</p>
                  <p className="font-medium">{userDetails.accountType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Account Status</p>
                  <div className="flex items-center mt-1">
                    {getStatusIcon(userDetails.accountStatus)}
                    <span className={`ml-2 px-2 py-0.5 rounded text-sm ${getStatusColor(userDetails.accountStatus)}`}>
                      {userDetails.accountStatus}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Member Since</p>
                  <p className="font-medium">{new Date(userDetails.createdAt).toLocaleDateString()}</p>
                </div>
                
                {/* Business Information for non-Individual accounts */}
                {['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(userDetails.accountType) && userDetails.businessName && (
                  <div>
                    <p className="text-sm text-gray-600">Business Name</p>
                    <p className="font-medium">{userDetails.businessName}</p>
                  </div>
                )}
                
                {/* TIN Information for business accounts */}
                {/* {['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(userDetails.accountType) && userDetails.tinNumber && (
                  <div>
                    <p className="text-sm text-gray-600">Tax Identification Number (TIN)</p>
                    <div className="flex items-center mt-1">
                      <svg className="h-4 w-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="font-medium text-blue-600">{userDetails.tinNumber}</p>
                    </div>
                  </div>
                )}
                 */}
                {/* Business Address for business accounts */}
                {['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(userDetails.accountType) && userDetails.businessAddress && (
                  <div>
                    <p className="text-sm text-gray-600">Business Address</p>
                    <p className="font-medium">{userDetails.businessAddress}</p>
                  </div>
                )}
                
                {/* SCUML License Information */}
                {userDetails.scumlNumber && ['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(userDetails.accountType) && (
                  <div>
                    <p className="text-sm text-gray-600">SCUML License</p>
                    <div className="flex items-center mt-1">
                      <Shield className="h-4 w-4 text-green-500 mr-2" />
                      <p className="font-medium text-green-600">{userDetails.scumlNumber}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Securities and Commodities Market License</p>
                  </div>
                )}
                {/* TIN Information */}
                {userDetails.tinNumber && ['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(userDetails.accountType) && (
                  <div>
                    <p className="text-sm text-gray-600">Tax Identification Number (TIN)</p>
                    <p className="font-medium">{userDetails.tinNumber}</p>
                  </div>
                )}
                
                {/* CAC Number Information for business accounts */}
                {['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(userDetails.accountType) && userDetails.rcNumber && (
                  <div>
                    <p className="text-sm text-gray-600">(CAC) Number</p>
                    <div className="flex items-center mt-1">
                      <svg className="h-4 w-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <p className="font-medium text-green-600">{userDetails.rcNumber}</p>
                    </div>
                  </div>
                )}
                
                {/* CAC Company Data - Show validated company information */}
                {userDetails.cacCompanyData && ['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(userDetails.accountType) && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600 mb-2">CAC Company Information</p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {userDetails.cacCompanyData.companyName && (
                          <div>
                            <p className="text-xs text-green-600 font-medium">Company Name</p>
                            <p className="text-sm text-green-800">{userDetails.cacCompanyData.companyName}</p>
                          </div>
                        )}
                        {userDetails.cacCompanyData.status && (
                          <div>
                            <p className="text-xs text-green-600 font-medium">Registration Status</p>
                            <p className="text-sm text-green-800">{userDetails.cacCompanyData.status}</p>
                          </div>
                        )}
                        {userDetails.cacCompanyData.companyType && (
                          <div>
                            <p className="text-xs text-green-600 font-medium">Company Type</p>
                            <p className="text-sm text-green-800">{userDetails.cacCompanyData.companyType}</p>
                          </div>
                        )}
                        {userDetails.cacCompanyData.registrationDate && (
                          <div>
                            <p className="text-xs text-green-600 font-medium">Registration Date</p>
                            <p className="text-sm text-green-800">{userDetails.cacCompanyData.registrationDate}</p>
                          </div>
                        )}
                        {userDetails.cacCompanyData.address && (
                          <div className="md:col-span-2">
                            <p className="text-xs text-green-600 font-medium">Registered Address</p>
                            <p className="text-sm text-green-800">{userDetails.cacCompanyData.address}</p>
                          </div>
                        )}
                        {userDetails.cacCompanyData && (
                          <div className="md:col-span-2">
                            <p className="text-xs text-green-600 font-medium">Company Data (RAW)</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              {Object.entries(userDetails.cacCompanyData).map(([key, value]) => (
                                <div key={key} className="flex">
                                  <span className="text-xs font-semibold text-gray-700 mr-2 break-words whitespace-pre-line">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
                                  <span className="text-xs text-gray-800 break-words whitespace-pre-line">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <p className="text-xs text-green-700 font-medium">Verified via CAC Database</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>            <div className="bg-white rounded-lg border p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Selfie Verification</h2>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(userDetails.selfieVerification?.status ?? '')}
                  <span className={`px-2 py-1 text-sm font-medium rounded-full ${getStatusColor(userDetails.selfieVerification?.status ?? '')}`}>
                    {userDetails.selfieVerification?.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Selfie Image */}
                <div className="relative">
                  <div className="w-50 h-50 rounded-lg overflow-hidden bg-gray-100 border">
                    {userDetails.selfieVerification?.fileUrl ? (
                      <img
                        src={userDetails.selfieVerification.fileUrl}
                        alt="User Selfie"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <User className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Details */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Captured At</p>
                    {userDetails.selfieVerification?.capturedAt && (
                      <div className="space-y-1">
                        <p className="font-medium">
                          {new Date(userDetails.selfieVerification.capturedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(userDetails.selfieVerification.capturedAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                            timeZoneName: 'short'
                          })}
                        </p>
                      </div>
                    )}
                    {!userDetails.selfieVerification?.capturedAt && (
                      <p className="font-medium">N/A</p>
                    )}
                  </div>



                  {userDetails.selfieVerification?.fileUrl && (
                    <a
                      href={userDetails.selfieVerification.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View Full Size</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* Verification Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Summary</h3>
              <div className="space-y-4">
                {/* Overall Progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Overall Progress</span>
                    <span className="font-medium">{userDetails.verificationStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${userDetails.verificationStatus.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Verification Stages */}
                <div className="border-t pt-4 space-y-3">
                  {/* KYC Status */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">KYC Documents</p>
                      <p className="text-xs text-gray-500">Identity verification</p>
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                      {getStatusIcon(userDetails.verificationStatus.kycStatus)}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(userDetails.verificationStatus.kycStatus)}`}>
                        {userDetails.verificationStatus.kycStatus}
                      </span>
                    </div>
                  </div>

                  {/* Selfie Status */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Selfie Verification</p>
                      <p className="text-xs text-gray-500">Liveness check & face match</p>
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                      {getStatusIcon(userDetails.verificationStatus.selfieStatus)}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(userDetails.verificationStatus.selfieStatus)}`}>
                        {userDetails.verificationStatus.selfieStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dojah Summary */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Dojah Verification</h3>
              </div>

              {/* Verification Statistics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">Total Verifications</p>
                  <p className="text-2xl font-semibold text-blue-700">
                    {userDetails?.dojahVerifications?.total || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">Success Rate</p>
                  <p className="text-2xl font-semibold text-green-700">
                    {userDetails?.dojahVerifications?.total ?
                      Math.round((userDetails.dojahVerifications.governmentVerifications.filter(v => v.isMatch).length /
                        userDetails.dojahVerifications.total) * 100) : 0}%
                  </p>
                </div>
              </div>

              {/* Verification Types */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-600">Government Lookups</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {userDetails?.dojahVerifications?.governmentVerifications?.length || 0}
                    </span>
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-600">AML Screenings</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {userDetails?.dojahVerifications?.amlScreenings?.length || 0}
                    </span>
                    <Shield className="h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {/* Latest Verification */}
                {userDetails?.dojahVerifications?.governmentVerifications?.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 mb-2">Latest Verification</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {userDetails.dojahVerifications.governmentVerifications[0].type.replace(/_/g, ' ')}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(userDetails.dojahVerifications.governmentVerifications[0].status)
                        }`}>
                        {userDetails.dojahVerifications.governmentVerifications[0].status}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}      {activeTab === 'documents' && (
        <div className="space-y-6">
          {userDetails.scumlNumber && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3" />
                <div>
                  <h3 className="text-base font-medium text-green-800">SCUML License Verified</h3>
                  <p className="text-sm text-green-700 mt-1">
                    This business account has been verified with SCUML License Number: <strong>{userDetails.scumlNumber}</strong>
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    Business accounts with valid SCUML licenses are automatically approved and do not require document uploads.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Documents & Dojah Verification</h2>
            <div className="text-sm text-gray-600">
              {userDetails.documents.length} document{userDetails.documents.length !== 1 ? 's' : ''} uploaded
            </div>
          </div>
          {/* Documents Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center">
              <FileText className="h-5 w-5 text-blue-600 mr-2" />
              Submitted Documents
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {userDetails.documents.map((doc) => {
                // Calculate verification steps with status
                const docStatus = doc.status || "PENDING";
                const verificationSteps = [
                  {
                    name: "Document Upload",
                    status: "SUCCESS",
                  },
                  // {
                  //   name: "Quality Check",
                  //   status: doc.documentAnalysis?.isReadable ? "SUCCESS" : doc.documentAnalysis ? "FAILED" : "PENDING",
                  // },
                  // {
                  //   name: "Data Extraction",
                  //   status: doc.dojahVerification?.extractedData ? "SUCCESS" : doc.dojahVerification ? "FAILED" : "PENDING",
                  // },
                  // {
                  //   name: "Government Database Match",
                  //   status: userDetails.dojahVerifications?.governmentVerifications?.some(v => v.isMatch)
                  //     ? "SUCCESS"
                  //     : userDetails.dojahVerifications?.governmentVerifications?.length > 0
                  //       ? "FAILED"
                  //       : "PENDING",
                  // }
                ];

                return (
                  <div key={doc.id} className="border border-gray-200 rounded-lg overflow-hidden">                    {/* Document header */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-md ${docStatus === "APPROVED" ? "bg-green-100" :
                          docStatus === "REJECTED" ? "bg-red-100" :
                            "bg-yellow-100"
                          }`}>
                          <FileText className={`h-5 w-5 ${docStatus === "APPROVED" ? "text-green-600" :
                            docStatus === "REJECTED" ? "text-red-600" :
                              "text-yellow-600"
                            }`} />
                        </div>
                        <div className="ml-3">
                          <div className="font-medium">{doc.type.replace(/_/g, ' ')}</div>
                          <div className="text-sm text-gray-500">{doc.fileName}</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {docStatus === "APPROVED" ? (
                          <div className="relative">
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              APPROVED
                            </span>
                          </div>
                        ) : docStatus === "REJECTED" ? (
                          <div className="relative">
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></div>
                            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              REJECTED
                            </span>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border-2 border-white rounded-full pulse-animation"></div>
                            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              PENDING
                            </span>
                          </div>
                        )}


                      </div>
                    </div>

                    {/* Document content */}
                    <div className="p-4">                      {/* Document info */}
                      <div className="flex items-center">
                        {/* <div className="flex-shrink-0 mr-4">
                          <div className={`h-20 w-20 border-2 ${docStatus === "APPROVED" ? "border-green-200 bg-green-50" :
                            docStatus === "REJECTED" ? "border-red-200 bg-red-50" :
                              "border-yellow-200 bg-yellow-50"
                            } rounded-lg flex items-center justify-center p-1 overflow-hidden`}>
                            {doc.documentAnalysis?.isReadable ? (
                              <div className="relative w-full h-full bg-white rounded overflow-hidden">
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-gray-400" />
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/20 to-transparent h-1/2"></div>
                              </div>
                            ) : (
                              <FileText className={`h-10 w-10 ${docStatus === "APPROVED" ? "text-green-400" :
                                docStatus === "REJECTED" ? "text-red-400" :
                                  "text-yellow-400"
                                }`} />
                            )}
                          </div>
                        </div> */}
                        {/* <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">{doc.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(doc.uploadedAt || "").toLocaleDateString()}
                            </p>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{doc.type.replace(/_/g, ' ')}</p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {doc.documentAnalysis?.isReadable && (
                              <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Readable
                              </span>
                            )}
                            {doc.dojahVerification?.extractedData && (
                              <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-md">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Data Extracted
                              </span>
                            )}
                            {doc.dojahVerification?.confidence && (
                              <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md">
                                <Shield className="h-3 w-3 mr-1" />
                                {doc.dojahVerification.confidence}% Confidence
                              </span>
                            )}
                          </div>
                        </div> */}
                      </div>

                      {/* Verification status */}
                      <div>
                        <h4 className="text-sm font-medium text-blue-700 flex items-center mb-3">
                          <Shield className="h-4 w-4 mr-1.5" />
                          Verification Process
                        </h4>

                        <div className="bg-blue-50 bg-opacity-50 rounded-lg p-4">
                          <div className="relative">
                            {/* Vertical timeline line */}
                            <div className="absolute left-4 top-1 bottom-0 w-0.5 bg-blue-200"></div>

                            {/* Steps */}
                            <div className="space-y-6">
                              {verificationSteps.map((step, i) => (
                                <div key={i} className="flex items-start ml-2">
                                  <div className="relative z-10">
                                    <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 ${step.status === "SUCCESS"
                                      ? "bg-green-500 border-green-500"
                                      : step.status === "FAILED"
                                        ? "bg-red-500 border-red-500"
                                        : "bg-yellow-400 border-yellow-400"
                                      }`}>
                                      {step.status === "SUCCESS" ? (
                                        <CheckCircle className="h-3 w-3 text-white" />
                                      ) : step.status === "FAILED" ? (
                                        <XCircle className="h-3 w-3 text-white" />
                                      ) : (
                                        <Clock className="h-3 w-3 text-white" />
                                      )}
                                    </div>
                                  </div>
                                  <div className="ml-4 flex-grow">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-gray-800">{step.name}</p>
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${step.status === "SUCCESS"
                                        ? "bg-green-100 text-green-800"
                                        : step.status === "FAILED"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-yellow-100 text-yellow-800"
                                        }`}>
                                        {step.status}
                                      </span>
                                    </div>
                                    {step.status === "FAILED" && (
                                      <p className="text-xs mt-1 text-red-600">Verification failed at this step</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* View details button */}
                      <div className="mt-5">
                        <button
                          onClick={() => {
                            // Toggle expanded state for this document
                            const isCurrentlyExpanded = expandedDocuments[doc.id] || false;
                            console.log(`Toggling document ${doc.id} expanded state from ${isCurrentlyExpanded} to ${!isCurrentlyExpanded}`);
                            setExpandedDocuments(prev => ({
                              ...prev,
                              [doc.id]: !isCurrentlyExpanded
                            }));
                          }}
                          className="w-full flex items-center justify-center py-2 px-4 border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          <span className="font-medium">{expandedDocuments[doc.id] ? 'Hide Detailed Analysis' : 'View Detailed Analysis'}</span>
                        </button>
                        {/* Debug information - showing expanded state for this document */}
                        <div className="text-xs text-gray-500 hidden">
                          Current document {doc.id} expanded status: {expandedDocuments[doc.id] ? 'Expanded' : 'Collapsed'}
                        </div>
                        {expandedDocuments[doc.id] && (<div className="mt-6 pt-5 border-t border-dashed border-gray-200 bg-gray-50 -mx-4 px-4 py-5 rounded-b-lg animate-fadeIn">
                          <div className="mb-4">
                            <h3 className="text-base font-medium text-gray-900 mb-4">Document Details</h3>

                            <div className="bg-white rounded-lg border shadow-sm p-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-gray-600 mb-1">Upload Date</p>
                                  <p className="font-medium text-sm">{new Date(doc.uploadedAt || "").toLocaleString()}</p>
                                </div>

                                <div>
                                  <p className="text-sm text-gray-600 mb-1">Document ID</p>
                                  <p className="font-medium text-sm text-gray-800">{doc.id}</p>
                                </div>

                                <div>
                                  <p className="text-sm text-gray-600 mb-1">Verification Status</p>
                                  <div className="flex items-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${doc.status === "APPROVED" ? "bg-green-100 text-green-800" : doc.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                                      {doc.status === "APPROVED" ? "Verified" : doc.status === "REJECTED" ? "Rejected" : "Pending"}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-sm text-gray-600 mb-1">Document Type</p>
                                  <p className="font-medium text-sm">{doc.type.replace(/_/g, ' ')}</p>
                                </div>
                              </div>
                                 <div>
                                  <p className="text-sm text-gray-600 mb-1">Reason</p>
                                  <div className="flex items-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${doc.status === "APPROVED" ? "bg-green-100 text-green-800" : doc.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                                      {doc.notes && doc.notes.trim() !== '' ? doc.notes : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              <div className="mt-4">
                                <p className="text-sm text-gray-600 mb-2">Doc Preview</p>
                                <div className="bg-white border border-gray-200 rounded-md p-3">
                                  <div className="flex flex-col md:flex-row gap-4">
                                    <div className="w-full md:w-2/3  rounded-md overflow-hidden bg-gray-50 border border-gray-200">
                                      {doc.fileName.toLowerCase().endsWith('.pdf') ? (
                                        <div className="w-full h-96 bg-white rounded-md">
                                          <iframe
                                            src={`/api/admin/submissions/${userId}/download?documentId=${doc.id}`}
                                            className="w-full h-full rounded-md"
                                            title={`PDF Preview - ${doc.fileName}`}
                                            onError={(e) => {
                                              const fallback = document.createElement('div');
                                              fallback.className = 'flex flex-col items-center justify-center h-full bg-gray-100 text-gray-500';
                                              fallback.innerHTML = `
                                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400 mb-2">
                                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                  <polyline points="14 2 14 8 20 8"></polyline>
                                                  <line x1="16" y1="13" x2="8" y2="13"></line>
                                                  <line x1="16" y1="17" x2="8" y2="17"></line>
                                                  <polyline points="10 9 9 9 8 9"></polyline>
                                                </svg>
                                                <p class="text-sm font-medium">PDF Preview Unavailable</p>
                                                <p class="text-xs">Click download to view file</p>
                                              `;
                                              e.currentTarget.parentElement?.appendChild(fallback);
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <img
                                          src={`/api/admin/submissions/${userId}/download?documentId=${doc.id}`}
                                          alt={doc.fileName}
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            e.currentTarget.src = '';
                                            e.currentTarget.classList.add('bg-gray-100');
                                            e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                            const icon = document.createElement('div');
                                            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
                                            e.currentTarget.parentElement?.appendChild(icon);
                                          }}
                                        />
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-800 mb-1">{doc.fileName}</p>
                                      <div className="space-y-1">
                                        {doc.fileSize && (
                                          <p className="text-xs text-gray-500">Size: {Math.round(doc.fileSize / 1024)} KB</p>
                                        )}
                                        <p className="text-xs text-gray-500">Type: {doc.type.replace(/_/g, ' ')}</p>                                        </div>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex justify-end space-x-2">                                      <a
                                    href={`/api/admin/submissions/${userId}/download?documentId=${doc.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-xs font-medium text-gray-700"
                                    title="Download Document"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </a>

                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                      {/* Admin review section */}
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-purple-700 flex items-center mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          Admin Review
                        </h4>

                        <div>
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Review Notes
                            </label>
                            <textarea
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Add any notes about this document..."
                              value={documentReviewNotes[doc.id] || ""}
                              onChange={(e) => setDocumentReviewNotes({
                                ...documentReviewNotes,
                                [doc.id]: e.target.value
                              })}
                              rows={3}
                            />
                          </div>

                          {isReviewing && (
                            <div className="mt-4 flex items-center justify-center space-x-2 p-2 bg-blue-50 rounded-lg">
                              <div className="animate-spin h-5 w-5 border-2 border-blue-600 rounded-full border-t-transparent"></div>
                              <span className="text-sm text-blue-600">Processing review submission...</span>
                            </div>
                          )}
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Review Decision
                          </label>
                          <div className="grid grid-cols-3 gap-2 mb-4">                            <button
                            onClick={() => handleReview(doc.id, "APPROVED", documentReviewNotes[doc.id] || "Document approved after verification")}
                            disabled={isReviewing}
                            className="flex flex-col items-center justify-center px-3 py-2 bg-white border-2 border-green-500 hover:bg-green-50 text-green-700 rounded-lg transition-colors"
                          >
                            <CheckCircle className="h-5 w-5 mb-1" />
                            <span className="text-sm font-medium">Approve</span>
                          </button>
                            <button
                              onClick={() => handleOpenRejectModal(doc.id, doc.type)}
                              disabled={isReviewing}
                              className="flex flex-col items-center justify-center px-3 py-2 bg-white border-2 border-red-500 hover:bg-red-50 text-red-700 rounded-lg transition-colors"
                            >
                              <XCircle className="h-5 w-5 mb-1" />
                              <span className="text-sm font-medium">Reject</span>
                            </button>
                            <button
                              onClick={() => handleReview(doc.id, "PENDING", documentReviewNotes[doc.id] || "Document flagged for additional review")}
                              disabled={isReviewing}
                              className="flex flex-col items-center justify-center px-3 py-2 bg-white border-2 border-yellow-500 hover:bg-yellow-50 text-yellow-700 rounded-lg transition-colors"
                            >
                              <Clock className="h-5 w-5 mb-1" />
                              <span className="text-sm font-medium">Flag</span>
                            </button>
                          </div>


                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {userDetails.documents.length === 0 && (
              <div className="text-center py-12">
                {userDetails.scumlNumber ? (
                  <div>
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-green-600 mb-1">SCUML License Verified</h3>
                    <p className="text-gray-600">SCUML Number: {userDetails.scumlNumber}</p>
                    <p className="text-sm text-gray-500 mt-2">This business account is verified via SCUML license</p>
                  </div>
                ) : (
                  <>
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No documents uploaded yet</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}      {/* Reject Document Modal */}
      {rejectModalOpen && currentRejectDocId && (
        <RejectDocumentModal
          open={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          onReject={handleRejectWithModal}
          reviewId={currentRejectDocId}
          documentType={currentDocType.replace(/_/g, ' ')}
        />
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Review History</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {userDetails.adminReviews.map((review) => (
              <div key={review.id} className="bg-white rounded-lg border p-6">
                {/* Review Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${getStatusColor(review.status)}`}>
                      {getStatusIcon(review.status)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">
                          {review.verificationType.replace(/_/g, ' ')}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(review.status)}`}>
                          {review.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          {review.reviewer.firstName} {review.reviewer.lastName}
                        </p>
                        <span className="text-gray-300">•</span>
                        <p className="text-sm text-gray-500">
                          {new Date(review.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Details */}
                <div className="space-y-4">
                  {/* Review Notes */}
                  {review.reviewNotes && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <p className="text-sm font-medium text-gray-700">Review Notes</p>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{review.reviewNotes}</p>
                    </div>
                  )}

                  {/* Rejection Details */}
                  {review.rejectionReason && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <p className="text-sm font-medium text-red-700">Rejection Details</p>
                      </div>
                      <p className="text-sm text-red-800 whitespace-pre-wrap">{review.rejectionReason}</p>
                    </div>
                  )}

                  {/* Reupload Status */}
                  {review.allowReupload && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <p className="text-sm text-yellow-800">User is allowed to reupload documents</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {userDetails.adminReviews.length === 0 && (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No review history available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
