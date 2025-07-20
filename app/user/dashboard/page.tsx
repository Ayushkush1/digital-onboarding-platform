'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Phone, MapPin, FileText, AlertCircle, CheckCircle,
  Clock, Headphones, FileQuestion, Shield, Bell, Moon, Sun,
  LogOut, RefreshCw, Building, Building2, User, Upload,
  Edit, Settings, CreditCard, TrendingUp, Activity, Calendar,
  DollarSign, Briefcase, Users, FileCheck, AlertTriangle,
  ChevronDown, ChevronUp, Plus, Minus, Eye, Download
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useVerificationStore } from '@/lib/verification-store';
import { VerificationStatusEnum, AccountType, DocumentType } from '@/app/generated/prisma';
import { fetchUserProfile, formatAccountType, getStatusBadgeColor } from '@/lib/profile-service';
import type { UserProfile } from '@/lib/profile-service';
import CreditScore from '@/components/dashboard/CreditScore';
import DocumentReuploadModal from '@/components/user/DocumentReuploadModal';
import BusinessValidationDisplay from '@/components/user/BusinessValidationDisplay';

interface DashboardSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
}

const UserDashboard = () => {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kycFormData, setKycFormData] = useState<any>(null);
  const [greeting, setGreeting] = useState('Good afternoon');
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [creditData, setCreditData] = useState<any>(null);
  const [businessValidationData, setBusinessValidationData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // State for document re-upload modal
  const [isReuploadModalOpen, setIsReuploadModalOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [selectedDocumentType, setSelectedDocumentType] = useState('');

  // Dashboard sections state
  const [sections, setSections] = useState<DashboardSection[]>([
    { id: 'profile', title: 'Profile Overview', icon: <User className="h-5 w-5" />, isExpanded: true },
    { id: 'verification', title: 'Verification Status', icon: <Shield className="h-5 w-5" />, isExpanded: true },
    { id: 'documents', title: 'Documents', icon: <FileText className="h-5 w-5" />, isExpanded: false },
    { id: 'business', title: 'Business Information', icon: <Building className="h-5 w-5" />, isExpanded: false },
    { id: 'credit', title: 'Credit Information', icon: <CreditCard className="h-5 w-5" />, isExpanded: false },
    { id: 'notifications', title: 'Notifications', icon: <Bell className="h-5 w-5" />, isExpanded: false },
    { id: 'activity', title: 'Activity Log', icon: <Activity className="h-5 w-5" />, isExpanded: false },
  ]);

  // Use the verification store for state management
  const {
    overallStatus: verificationStatus,
    progress,
    fetchVerificationStatus,
    resetError
  } = useVerificationStore();

  // Check if user is authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/access');
    }
  }, [user, loading, router]);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Fetch comprehensive user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;

      try {
        setIsLoadingProfile(true);
        setError(null);

        // Fetch all user data in parallel
        const [
          profile, 
          kycResponse, 
          notificationsResponse, 
          creditResponse,
          businessValidationResponse,
          auditLogsResponse
        ] = await Promise.all([
          fetchUserProfile(),
          fetch('/api/user/kyc-form-data').then(res => res.ok ? res.json() : null),
          fetch('/api/user/notifications').then(res => res.ok ? res.json() : null),
          fetch('/api/user/cibil-score').then(res => res.ok ? res.json() : null),
          fetch('/api/user/business-validation').then(res => res.ok ? res.json() : null),
          fetch('/api/user/audit-logs').then(res => res.ok ? res.json() : null)
        ]);

        setUserProfile(profile);
        if (kycResponse?.data) setKycFormData(kycResponse.data);
        if (notificationsResponse?.notifications) setNotifications(notificationsResponse.notifications);
        if (creditResponse?.data) setCreditData(creditResponse.data);
        if (businessValidationResponse?.validation) setBusinessValidationData(businessValidationResponse.validation);
        if (auditLogsResponse?.logs) setAuditLogs(auditLogsResponse.logs);

        // Update verification status
        await fetchVerificationStatus(user.id);
      } catch (err) {
        console.error('Error loading user data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load user data');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadUserData();
  }, [user, fetchVerificationStatus]);

  // Handle document re-upload button click
  const handleReuploadClick = (documentId: string, documentType: string) => {
    setSelectedDocumentId(documentId);
    setSelectedDocumentType(documentType);
    setIsReuploadModalOpen(true);
  };

  // Handle successful re-upload
  const handleReuploadSuccess = () => {
    setIsLoadingProfile(true);
    fetchUserProfile()
      .then(data => {
        setUserProfile(data);
        setIsLoadingProfile(false);
      })
      .catch(err => {
        console.error('Error refreshing profile after reupload:', err);
        setError('Failed to refresh profile data');
        setIsLoadingProfile(false);
      });
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, isExpanded: !section.isExpanded }
        : section
    ));
  };

  const getAccountTypeIcon = (accountType: AccountType) => {
    switch (accountType) {
      case 'INDIVIDUAL':
        return <User className="h-5 w-5" />;
      case 'PARTNERSHIP':
        return <Building className="h-5 w-5" />;
      case 'ENTERPRISE':
      case 'LLC':
        return <Building2 className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  // Helper function to get SCUML number from either account or KYC form data
  const getSCUMLNumber = () => {
    return userProfile?.account?.scumlNumber || kycFormData?.scumlNumber || null;
  };

  // Check if user has SCUML license
  const hasSCUMLLicense = () => {
    const scumlNumber = getSCUMLNumber();
    const accountType = userProfile?.accountType;
    return scumlNumber && ['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(accountType || '');
  };

  // Check if user is business account
  const isBusinessAccount = () => {
    return ['PARTNERSHIP', 'ENTERPRISE', 'LLC'].includes(userProfile?.accountType || '');
  };

  // Format date for display
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoadingProfile || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Dashboard</h3>
              <p className="text-red-700 mt-1">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center text-red-600 hover:text-red-800"
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {greeting}, {userProfile?.firstName || 'User'}
            </h1>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
              Welcome back to your dashboard
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-600'
                } hover:bg-opacity-80`}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Dashboard Sections */}
        <div className="space-y-6">
          {/* Profile Overview Section */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('profile')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'profile')?.icon}
                <h2 className="text-xl font-bold">Profile Overview</h2>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusBadgeColor(userProfile?.accountStatus || 'PENDING', darkMode)}`}>
                  {userProfile?.accountStatus.replace('_', ' ')}
                </span>
                {sections.find(s => s.id === 'profile')?.isExpanded ? 
                  <ChevronUp className="h-5 w-5" /> : 
                  <ChevronDown className="h-5 w-5" />
                }
              </div>
            </div>

            {sections.find(s => s.id === 'profile')?.isExpanded && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <Mail className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                      <div>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Email Address</p>
                        <p className="font-medium">{userProfile?.email}</p>
                      </div>
                    </div>

                    {userProfile?.phone && (
                      <div className="flex items-start">
                        <Phone className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                        <div>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Phone Number</p>
                          <p className="font-medium">{userProfile.phone}</p>
                        </div>
                      </div>
                    )}

                    {userProfile?.dateOfBirth && (
                      <div className="flex items-start">
                        <Calendar className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                        <div>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Date of Birth</p>
                          <p className="font-medium">{formatDate(userProfile.dateOfBirth)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {userProfile?.address && (
                      <div className="flex items-start">
                        <MapPin className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                        <div>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Address</p>
                          <p className="font-medium">{userProfile.address}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start">
                      {getAccountTypeIcon(userProfile?.accountType || 'INDIVIDUAL')}
                      <div className="ml-3">
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Account Type</p>
                        <p className="font-medium">{formatAccountType(userProfile?.accountType || 'INDIVIDUAL')}</p>
                      </div>
                    </div>

                    {/* SCUML License Information */}
                    {hasSCUMLLicense() && (
                      <div className={`flex items-start p-3 rounded-lg ${darkMode ? 'bg-green-800/20 border border-green-600/30' : 'bg-green-50 border border-green-200'}`}>
                        <div className={`${darkMode ? 'bg-green-700' : 'bg-green-100'} rounded-full p-2`}>
                          <Shield className={`h-5 w-5 ${darkMode ? 'text-green-300' : 'text-green-600'}`} />
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${darkMode ? 'text-green-300' : 'text-green-800'}`}>SCUML License</p>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${darkMode ? 'bg-green-700 text-green-200' : 'bg-green-100 text-green-800'}`}>
                              Verified
                            </span>
                          </div>
                          <p className={`font-mono text-lg ${darkMode ? 'text-green-200' : 'text-green-900'} mt-1`}>{getSCUMLNumber()}</p>
                          <p className={`text-xs ${darkMode ? 'text-green-300/70' : 'text-green-600'} mt-1`}>
                            Securities and Commodities Market License
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Actions */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex space-x-4">
                    <button className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </button>
                    <button className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
                      <Settings className="h-4 w-4 mr-2" />
                      Account Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Verification Status Section */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('verification')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'verification')?.icon}
                <h2 className="text-xl font-bold">Verification Status</h2>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusBadgeColor(verificationStatus || 'PENDING', darkMode)}`}>
                  {verificationStatus?.replace('_', ' ')}
                </span>
                {sections.find(s => s.id === 'verification')?.isExpanded ? 
                  <ChevronUp className="h-5 w-5" /> : 
                  <ChevronDown className="h-5 w-5" />
                }
              </div>
            </div>

            {sections.find(s => s.id === 'verification')?.isExpanded && (
              <div className="px-6 pb-6">
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span className={`font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{progress}%</span>
                  </div>
                  <div className={`h-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                    <div
                      className={`h-full ${darkMode ? 'bg-blue-500' : 'bg-blue-600'} rounded-full transition-all duration-500 ease-out`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">KYC Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(verificationStatus || 'PENDING', darkMode)}`}>
                        {verificationStatus?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Selfie Verification</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(verificationStatus || 'PENDING', darkMode)}`}>
                        {verificationStatus?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(verificationStatus || 'PENDING', darkMode)}`}>
                        {verificationStatus?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Business Information Section - Only for business accounts */}
          {isBusinessAccount() && (
            <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
              <div 
                className="flex items-center justify-between p-6 cursor-pointer"
                onClick={() => toggleSection('business')}
              >
                <div className="flex items-center space-x-3">
                  {sections.find(s => s.id === 'business')?.icon}
                  <h2 className="text-xl font-bold">Business Information</h2>
                </div>
                {sections.find(s => s.id === 'business')?.isExpanded ? 
                  <ChevronUp className="h-5 w-5" /> : 
                  <ChevronDown className="h-5 w-5" />
                }
              </div>

              {sections.find(s => s.id === 'business')?.isExpanded && (
                <div className="px-6 pb-6">
                  {/* Business Validation Display */}
                  {businessValidationData && (
                    <div className="mb-6">
                      <BusinessValidationDisplay 
                        validationData={businessValidationData}
                        darkMode={darkMode}
                      />
                    </div>
                  )}

                  {/* Business Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {userProfile?.account?.businessName && (
                        <div className="flex items-start">
                          <Building className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                          <div>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Business Name</p>
                            <p className="font-medium">{userProfile.account.businessName}</p>
                          </div>
                        </div>
                      )}

                      {userProfile?.account?.businessType && (
                        <div className="flex items-start">
                          <Briefcase className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                          <div>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Business Type</p>
                            <p className="font-medium">{userProfile.account.businessType.replace('_', ' ')}</p>
                          </div>
                        </div>
                      )}

                      {userProfile?.account?.businessAddress && (
                        <div className="flex items-start">
                          <MapPin className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                          <div>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Business Address</p>
                            <p className="font-medium">{userProfile.account.businessAddress}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {userProfile?.account?.taxNumber && (
                        <div className="flex items-start">
                          <DollarSign className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                          <div>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Tax Number</p>
                            <p className="font-medium">{userProfile.account.taxNumber}</p>
                          </div>
                        </div>
                      )}

                      {userProfile?.account?.scumlNumber && (
                        <div className="flex items-start">
                          <Shield className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                          <div>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>SCUML Number</p>
                            <p className="font-medium">{userProfile.account.scumlNumber}</p>
                          </div>
                        </div>
                      )}

                      {userProfile?.account?.occupation && (
                        <div className="flex items-start">
                          <Users className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 mr-3`} />
                          <div>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Occupation</p>
                            <p className="font-medium">{userProfile.account.occupation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Business Actions */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex space-x-4">
                      <button className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800">
                        <Edit className="h-4 w-4 mr-2" />
                        Update Business Info
                      </button>
                      <button className="flex items-center px-4 py-2 text-sm font-medium text-green-600 hover:text-green-800">
                        <FileCheck className="h-4 w-4 mr-2" />
                        Validate Business
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Documents Section */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('documents')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'documents')?.icon}
                <h2 className="text-xl font-bold">Documents</h2>
                {userProfile?.documents && userProfile.documents.length > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs ${darkMode ? 'bg-blue-600 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
                    {userProfile.documents.length}
                  </span>
                )}
              </div>
              {sections.find(s => s.id === 'documents')?.isExpanded ? 
                <ChevronUp className="h-5 w-5" /> : 
                <ChevronDown className="h-5 w-5" />
              }
            </div>

            {sections.find(s => s.id === 'documents')?.isExpanded && (
              <div className="px-6 pb-6">
                {userProfile?.documents && userProfile.documents.length > 0 ? (
                  <div className="space-y-4">
                    {userProfile.documents.map((doc, index) => (
                      <div key={doc.id} className={`p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-medium">{doc.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</h3>
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {formatDate(doc.uploadedAt)}
                              </p>
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {doc.fileName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(doc.status, darkMode)}`}>
                              {doc.status}
                            </span>

                            {doc.status === 'REQUIRES_REUPLOAD' && (
                              <button
                                onClick={() => handleReuploadClick(doc.id, doc.type)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center"
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Reupload
                              </button>
                            )}

                            {doc.verified && (
                              <CheckCircle className={`h-4 w-4 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    {hasSCUMLLicense() ? (
                      <div className="space-y-4">
                        <div className={`${darkMode ? 'bg-green-800/20 border-green-600/30' : 'bg-green-50 border-green-200'} border rounded-lg p-6`}>
                          <div className="flex items-center justify-center mb-4">
                            <div className={`${darkMode ? 'bg-green-700' : 'bg-green-100'} rounded-full p-3`}>
                              <Shield className={`h-8 w-8 ${darkMode ? 'text-green-300' : 'text-green-600'}`} />
                            </div>
                          </div>
                          <h3 className={`text-lg font-semibold ${darkMode ? 'text-green-300' : 'text-green-800'} mb-2`}>
                            SCUML License Verification
                          </h3>
                          <p className={`${darkMode ? 'text-green-200' : 'text-green-700'} mb-4`}>
                            Your account is verified through your Securities and Commodities Market License.
                          </p>
                          <div className={`${darkMode ? 'bg-green-900/30' : 'bg-white'} rounded-md p-4 border ${darkMode ? 'border-green-600/20' : 'border-green-100'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className={`text-sm font-medium ${darkMode ? 'text-green-300' : 'text-green-800'}`}>License Number</p>
                                <p className={`text-lg font-mono ${darkMode ? 'text-green-200' : 'text-green-900'}`}>
                                  {getSCUMLNumber()}
                                </p>
                              </div>
                              <CheckCircle className={`h-6 w-6 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No documents uploaded yet.</p>
                        <Link
                          href="/user/upload-kyc-documents"
                          className={`mt-4 inline-flex items-center px-4 py-2 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
                            } text-white font-medium rounded-lg transition-colors`}
                        >
                          Upload your documents
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Credit Information Section */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('credit')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'credit')?.icon}
                <h2 className="text-xl font-bold">Credit Information</h2>
              </div>
              {sections.find(s => s.id === 'credit')?.isExpanded ? 
                <ChevronUp className="h-5 w-5" /> : 
                <ChevronDown className="h-5 w-5" />
              }
            </div>

            {sections.find(s => s.id === 'credit')?.isExpanded && (
              <div className="px-6 pb-6">
                <CreditScore darkMode={darkMode} />
              </div>
            )}
          </section>

          {/* Notifications Section */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('notifications')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'notifications')?.icon}
                <h2 className="text-xl font-bold">Notifications</h2>
                {notifications.length > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs ${darkMode ? 'bg-red-600 text-red-200' : 'bg-red-100 text-red-800'}`}>
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </div>
              {sections.find(s => s.id === 'notifications')?.isExpanded ? 
                <ChevronUp className="h-5 w-5" /> : 
                <ChevronDown className="h-5 w-5" />
              }
            </div>

            {sections.find(s => s.id === 'notifications')?.isExpanded && (
              <div className="px-6 pb-6">
                {notifications.length > 0 ? (
                  <div className="space-y-4">
                    {notifications.slice(0, 5).map((notification) => (
                      <div key={notification.id} className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-medium">{notification.title}</h3>
                              {!notification.read && (
                                <span className={`w-2 h-2 rounded-full ${darkMode ? 'bg-blue-400' : 'bg-blue-600'}`}></span>
                              )}
                            </div>
                            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              {notification.message}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                              {formatDate(notification.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {notification.type === 'SUCCESS' && <CheckCircle className={`h-4 w-4 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />}
                            {notification.type === 'ERROR' && <AlertTriangle className={`h-4 w-4 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />}
                            {notification.type === 'WARNING' && <AlertCircle className={`h-4 w-4 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Bell className={`h-12 w-12 ${darkMode ? 'text-gray-400' : 'text-gray-300'} mx-auto mb-4`} />
                    <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No notifications yet.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Activity Log Section */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('activity')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'activity')?.icon}
                <h2 className="text-xl font-bold">Activity Log</h2>
                {auditLogs.length > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs ${darkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                    {auditLogs.length}
                  </span>
                )}
              </div>
              {sections.find(s => s.id === 'activity')?.isExpanded ? 
                <ChevronUp className="h-5 w-5" /> : 
                <ChevronDown className="h-5 w-5" />
              }
            </div>

            {sections.find(s => s.id === 'activity')?.isExpanded && (
              <div className="px-6 pb-6">
                {auditLogs.length > 0 ? (
                  <div className="space-y-4">
                    {auditLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-medium">{log.action.replace(/_/g, ' ')}</h3>
                            </div>
                            {log.details && (
                              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {log.details}
                              </p>
                            )}
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                              {formatDate(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Activity className={`h-12 w-12 ${darkMode ? 'text-gray-400' : 'text-gray-300'} mx-auto mb-4`} />
                    <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No activity recorded yet.</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Quick Actions Footer */}
        <div className="mt-8">
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 shadow-sm`}>
            <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/user/verification-status"
                className={`flex items-center p-3 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  } transition-colors`}
              >
                <Shield className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mr-3`} />
                <div>
                  <p className="font-medium">Verification Status</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Check progress</p>
                </div>
              </Link>

              <Link
                href="/user/upload-kyc-documents"
                className={`flex items-center p-3 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  } transition-colors`}
              >
                <Upload className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mr-3`} />
                <div>
                  <p className="font-medium">Upload Documents</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Submit KYC docs</p>
                </div>
              </Link>

              <Link
                href="/user/selfie-verification"
                className={`flex items-center p-3 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  } transition-colors`}
              >
                <User className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mr-3`} />
                <div>
                  <p className="font-medium">Selfie Verification</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Complete verification</p>
                </div>
              </Link>

              <Link
                href="#support"
                className={`flex items-center p-3 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  } transition-colors`}
              >
                <Headphones className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mr-3`} />
                <div>
                  <p className="font-medium">Support</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Get help</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Document Re-upload Modal */}
      <DocumentReuploadModal
        isOpen={isReuploadModalOpen}
        onClose={() => setIsReuploadModalOpen(false)}
        documentId={selectedDocumentId}
        documentType={selectedDocumentType}
        onSuccess={handleReuploadSuccess}
      />
    </div>
  );
};

export default UserDashboard;


