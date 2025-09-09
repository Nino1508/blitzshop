import React, { useState, useCallback } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  Banner,
  BlockStack,
  Text,
  Icon
} from '@shopify/polaris';
import { ViewIcon, HideIcon } from '@shopify/polaris-icons';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ChangePasswordModal = ({ open, onClose }) => {
  const { getAuthToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Password visibility
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      if (!success) {
        setFormData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        setError(null);
        setSuccess(false);
      }
    }
  }, [open]);

  const handleChange = useCallback((value, field) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  }, []);

  const validateForm = () => {
    // Check all fields are filled
    if (!formData.current_password || !formData.new_password || !formData.confirm_password) {
      setError('All fields are required');
      return false;
    }

    // Check new password length
    if (formData.new_password.length < 6) {
      setError('New password must be at least 6 characters');
      return false;
    }

    // Check passwords match
    if (formData.new_password !== formData.confirm_password) {
      setError('New passwords do not match');
      return false;
    }

    // Check new password is different from current
    if (formData.current_password === formData.new_password) {
      setError('New password must be different from current password');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${API_URL}/api/users/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          current_password: formData.current_password,
          new_password: formData.new_password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      // Show success message
      setSuccess(true);
      setLoading(false);
      
      // Clear form
      setFormData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Password"
      primaryAction={{
        content: 'Change Password',
        onAction: handleSubmit,
        loading: loading,
        disabled: loading
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose,
          disabled: loading
        }
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Success Message */}
          {success && (
            <Banner tone="success" title="Success">
              <p>Password changed successfully!</p>
            </Banner>
          )}
          
          {/* Error Message */}
          {error && (
            <Banner tone="critical" title="Error">
              <p>{error}</p>
            </Banner>
          )}

          {/* Password Requirements Info */}
          <Banner tone="info">
            <p>Password must be at least 6 characters long</p>
          </Banner>

          <FormLayout>
            <TextField
              label="Current Password"
              type={showPasswords.current ? "text" : "password"}
              value={formData.current_password}
              onChange={(value) => handleChange(value, 'current_password')}
              autoComplete="current-password"
              disabled={loading}
              helpText="Enter your current password"
              suffix={
                <div 
                  onClick={() => setShowPasswords(prev => ({
                    ...prev,
                    current: !prev.current
                  }))}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Icon source={showPasswords.current ? HideIcon : ViewIcon} color="subdued" />
                </div>
              }
            />
            
            <TextField
              label="New Password"
              type={showPasswords.new ? "text" : "password"}
              value={formData.new_password}
              onChange={(value) => handleChange(value, 'new_password')}
              autoComplete="new-password"
              disabled={loading}
              helpText="Enter your new password (min. 6 characters)"
              error={formData.new_password && formData.new_password.length < 6 ? 
                'Password must be at least 6 characters' : undefined}
              suffix={
                <div 
                  onClick={() => setShowPasswords(prev => ({
                    ...prev,
                    new: !prev.new
                  }))}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Icon source={showPasswords.new ? HideIcon : ViewIcon} color="subdued" />
                </div>
              }
            />

            <TextField
              label="Confirm New Password"
              type={showPasswords.confirm ? "text" : "password"}
              value={formData.confirm_password}
              onChange={(value) => handleChange(value, 'confirm_password')}
              autoComplete="new-password"
              disabled={loading}
              helpText="Re-enter your new password"
              error={formData.confirm_password && formData.confirm_password !== formData.new_password ? 
                'Passwords do not match' : undefined}
              suffix={
                <div 
                  onClick={() => setShowPasswords(prev => ({
                    ...prev,
                    confirm: !prev.confirm
                  }))}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Icon source={showPasswords.confirm ? HideIcon : ViewIcon} color="subdued" />
                </div>
              }
            />
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default ChangePasswordModal;