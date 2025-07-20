'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Shield, Bell, Settings, Key, Eye, EyeOff,
  Save, X, AlertCircle, CheckCircle, Trash2, Download,
  Upload, Lock, Unlock, Smartphone, Mail, Globe, ChevronUp, ChevronDown, Edit
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { fetchUserProfile } from '@/lib/profile-service';
import type { UserProfile } from '@/lib/profile-service';
import ProfileManagement from '@/components/user/ProfileManagement';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
}

const UserSettings = () => {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showProfileManagement, setShowProfileManagement] = useState(false);

  // Settings sections state
  const [sections, setSections] = useState<SettingsSection[]>([
    { id: 'profile', title: 'Profile Settings', icon: <User className="h-5 w-5" />, isExpanded: true },
    { id: 'security', title: 'Security', icon: <Shield className="h-5 w-5" />, isExpanded: false },
    { id: 'notifications', title: 'Notifications', icon: <Bell className="h-5 w-5" />, isExpanded: false },
    { id: 'preferences', title: 'Preferences', icon: <Settings className="h-5 w-5" />, isExpanded: false },
  ]);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    documentUpdates: true,
    verificationStatus: true,
    securityAlerts: true,
    marketingEmails: false
  });

  // Check if user is authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/access');
    }
  }, [user, loading, router]);

  // Fetch user profile data
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        const profile = await fetchUserProfile();
        setUserProfile(profile);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load user profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, isExpanded: !section.isExpanded }
        : section
    ));
  };

  // Handle profile save
  const handleProfileSave = async (profileData: any) => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Refresh profile data
      const updatedProfile = await fetchUserProfile();
      setUserProfile(updatedProfile);
      setShowProfileManagement(false);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update profile');
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setIsChangingPassword(true);
      setError(null);

      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      // Show success message
    } catch (error: any) {
      setError(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle notification preferences update
  const handleNotificationPrefsUpdate = async () => {
    try {
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationPrefs)
      });

      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }

      // Show success message
    } catch (error: any) {
      setError(error.message || 'Failed to update notification preferences');
    }
  };

  // Handle account deletion
  const handleAccountDeletion = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      await signOut();
      router.push('/');
    } catch (error: any) {
      setError(error.message || 'Failed to delete account');
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading settings...</p>
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
              <h3 className="text-red-800 font-medium">Error Loading Settings</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Account Settings</h1>
          <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Manage your account preferences and security settings
          </p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Profile Settings */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('profile')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'profile')?.icon}
                <h2 className="text-xl font-bold">Profile Settings</h2>
              </div>
              {sections.find(s => s.id === 'profile')?.isExpanded ? 
                <ChevronUp className="h-5 w-5" /> : 
                <ChevronDown className="h-5 w-5" />
              }
            </div>

            {sections.find(s => s.id === 'profile')?.isExpanded && (
              <div className="px-6 pb-6">
                {showProfileManagement ? (
                  <ProfileManagement
                    initialData={{
                      firstName: userProfile?.firstName || '',
                      lastName: userProfile?.lastName || '',
                      email: userProfile?.email || '',
                      phone: userProfile?.phone || '',
                      address: userProfile?.address || '',
                      dateOfBirth: userProfile?.dateOfBirth ? new Date(userProfile.dateOfBirth).toISOString().split('T')[0] : '',
                      accountType: userProfile?.accountType || 'INDIVIDUAL',
                      businessName: userProfile?.account?.businessName || '',
                      businessType: userProfile?.account?.businessType || undefined,
                      businessAddress: userProfile?.account?.businessAddress || '',
                      taxNumber: userProfile?.account?.taxNumber || '',
                      scumlNumber: userProfile?.account?.scumlNumber || '',
                      occupation: userProfile?.account?.occupation || '',
                      sourceOfIncome: userProfile?.account?.sourceOfIncome || ''
                    }}
                    onSave={handleProfileSave}
                    onCancel={() => setShowProfileManagement(false)}
                    darkMode={darkMode}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Personal Information</h3>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Update your personal details and contact information
                        </p>
                      </div>
                      <button
                        onClick={() => setShowProfileManagement(true)}
                        className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Name</p>
                        <p className="font-medium">{userProfile?.firstName} {userProfile?.lastName}</p>
                      </div>
                      <div>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Email</p>
                        <p className="font-medium">{userProfile?.email}</p>
                      </div>
                      <div>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Phone</p>
                        <p className="font-medium">{userProfile?.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Account Type</p>
                        <p className="font-medium">{userProfile?.accountType?.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Security Settings */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('security')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'security')?.icon}
                <h2 className="text-xl font-bold">Security</h2>
              </div>
              {sections.find(s => s.id === 'security')?.isExpanded ? 
                <ChevronUp className="h-5 w-5" /> : 
                <ChevronDown className="h-5 w-5" />
              }
            </div>

            {sections.find(s => s.id === 'security')?.isExpanded && (
              <div className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Password Change */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Change Password</h3>
                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showPasswords ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          New Password
                        </label>
                        <input
                          type={showPasswords ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Confirm New Password
                        </label>
                        <input
                          type={showPasswords ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                          }`}
                        />
                      </div>

                      <button
                        onClick={handlePasswordChange}
                        disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                        className={`w-full py-2 px-4 rounded-lg font-medium text-white ${
                          isChangingPassword || !currentPassword || !newPassword || !confirmPassword
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                      </button>
                    </div>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Two-Factor Authentication</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">SMS Authentication</p>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Receive verification codes via SMS
                        </p>
                      </div>
                      <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800">
                        Enable
                      </button>
                    </div>
                  </div>

                  {/* Account Deletion */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold mb-4 text-red-600">Danger Zone</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-600">Delete Account</p>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Permanently delete your account and all associated data
                        </p>
                      </div>
                      <button
                        onClick={handleAccountDeletion}
                        className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Notification Settings */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('notifications')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'notifications')?.icon}
                <h2 className="text-xl font-bold">Notifications</h2>
              </div>
              {sections.find(s => s.id === 'notifications')?.isExpanded ? 
                <ChevronUp className="h-5 w-5" /> : 
                <ChevronDown className="h-5 w-5" />
              }
            </div>

            {sections.find(s => s.id === 'notifications')?.isExpanded && (
              <div className="px-6 pb-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Receive notifications via email
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationPrefs.emailNotifications}
                        onChange={(e) => setNotificationPrefs(prev => ({
                          ...prev,
                          emailNotifications: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="h-5 w-5" />
                      <div>
                        <p className="font-medium">SMS Notifications</p>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Receive notifications via SMS
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationPrefs.smsNotifications}
                        onChange={(e) => setNotificationPrefs(prev => ({
                          ...prev,
                          smsNotifications: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Globe className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Push Notifications</p>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Receive browser push notifications
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationPrefs.pushNotifications}
                        onChange={(e) => setNotificationPrefs(prev => ({
                          ...prev,
                          pushNotifications: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleNotificationPrefsUpdate}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      Save Notification Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Preferences */}
          <section className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-sm`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer"
              onClick={() => toggleSection('preferences')}
            >
              <div className="flex items-center space-x-3">
                {sections.find(s => s.id === 'preferences')?.icon}
                <h2 className="text-xl font-bold">Preferences</h2>
              </div>
              {sections.find(s => s.id === 'preferences')?.isExpanded ? 
                <ChevronUp className="h-5 w-5" /> : 
                <ChevronDown className="h-5 w-5" />
              }
            </div>

            {sections.find(s => s.id === 'preferences')?.isExpanded && (
              <div className="px-6 pb-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Dark Mode</p>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Switch between light and dark themes
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={darkMode}
                        onChange={() => setDarkMode(!darkMode)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Data Export</p>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Download your personal data
                      </p>
                    </div>
                    <button className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800">
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default UserSettings; 