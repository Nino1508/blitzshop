import React, { useState } from 'react';
import {
  Modal,
  Card,
  BlockStack,
  Text,
  TextField,
  Banner,
  InlineStack,
  Icon,
  Button
} from '@shopify/polaris';
import { 
  AlertCircleIcon, 
  ViewIcon, 
  HideIcon 
} from '@shopify/polaris-icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DeleteAccountModal = ({ open, onClose }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await axios.delete(
        `${API_URL}/api/users/delete-account`,
        {
          data: { password },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.status === 200) {
        setSuccess(true);
        
        // Wait 2 seconds to show success message, then logout
        setTimeout(() => {
          logout();
          navigate('/');
        }, 2000);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(err.response?.data?.error || 'Failed to delete account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!success) {  // Only allow closing if not in successful deletion process
      setPassword('');
      setShowPassword(false);
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Delete Account"
      primaryAction={success ? null : {
        content: loading ? 'Deleting...' : 'Permanently Delete Account',
        destructive: true,
        onAction: handleDelete,
        loading: loading,
        disabled: loading || !password
      }}
      secondaryActions={success ? [] : [
        {
          content: 'Cancel',
          onAction: handleClose,
          disabled: loading
        }
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Success Message */}
          {success && (
            <Banner status="success" icon={AlertCircleIcon}>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  ✅ Account Deleted Successfully
                </Text>
                <Text variant="bodyMd">
                  Your account has been permanently deleted. You will be redirected to the home page...
                </Text>
              </BlockStack>
            </Banner>
          )}

          {/* Warning Banner - Solo mostrar si no hay éxito */}
          {!success && (
            <Banner status="critical" icon={AlertCircleIcon}>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  ⚠️ This action cannot be undone
                </Text>
                <Text variant="bodyMd">
                  All your data will be permanently deleted including:
                </Text>
                <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                  <li>Profile and personal information</li>
                  <li>Order history and receipts</li>
                  <li>Shopping cart and saved items</li>
                </ul>
              </BlockStack>
            </Banner>
          )}

          {/* Error Message */}
          {error && !success && (
            <Banner status="critical">
              {error}
            </Banner>
          )}

          {/* Password Input - Solo mostrar si no hay éxito */}
          {!success && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">
                  Confirm your password
                </Text>
                
                <Text variant="bodyMd" color="subdued">
                  For security reasons, please enter your password to confirm account deletion.
                </Text>

                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                  error={error && error.includes('password') ? error : ''}
                  autoComplete="current-password"
                  focused
                  suffix={
                    <div 
                      onClick={togglePasswordVisibility}
                      style={{ 
                        cursor: 'pointer', 
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Icon source={showPassword ? HideIcon : ViewIcon} color="subdued" />
                    </div>
                  }
                />
              </BlockStack>
            </Card>
          )}

          {/* Help text - Solo mostrar si no hay éxito */}
          {!success && (
            <Text variant="bodySm" color="subdued" alignment="center">
              Need help? Contact support instead of deleting your account.
            </Text>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default DeleteAccountModal;