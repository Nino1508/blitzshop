import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  Checkbox
} from '@shopify/polaris';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const NotificationSettings = ({ open, onClose, user }) => {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      // Get the most recent user data from localStorage
      const userData = JSON.parse(localStorage.getItem('ecommerce-user-data') || '{}');
      setEmailNotifications(userData.email_notifications !== false);
      setSuccess(false);
      setError('');
    }
  }, [open]);

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await axios.put(
        `${API_URL}/api/users/notifications`,
        { email_notifications: emailNotifications },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess(true);
      
      // Update user data in localStorage
      const userData = JSON.parse(localStorage.getItem('ecommerce-user-data') || '{}');
      userData.email_notifications = emailNotifications;
      localStorage.setItem('ecommerce-user-data', JSON.stringify(userData));

      // Update user in context if updateUser function exists
      if (typeof window.updateUserContext === 'function') {
        window.updateUserContext({ ...user, email_notifications: emailNotifications });
      }

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update notification settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notification Settings"
      primaryAction={{
        content: 'Save Settings',
        onAction: handleSave,
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
          {success && (
            <Banner status="success">
              Notification preferences updated successfully!
            </Banner>
          )}
          
          {error && (
            <Banner status="critical">
              {error}
            </Banner>
          )}

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Email Preferences
              </Text>
              
              <Checkbox
                label="Order Updates"
                helpText="Receive email notifications when your order status changes (processing, shipped, delivered)"
                checked={emailNotifications}
                onChange={setEmailNotifications}
              />
              
              <Text variant="bodySm" color="subdued">
                You can change these preferences at any time from your profile settings.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default NotificationSettings;