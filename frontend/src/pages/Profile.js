import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Modal
} from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';
import OrderHistory from '../components/OrderHistory';
import EditProfileModal from '../components/EditProfileModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import NotificationSettings from '../components/NotificationSettings';
import DeleteAccountModal from '../components/DeleteAccountModal';

function Profile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, loading, updateUser } = useAuth();
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated()) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleEditProfile = () => {
    setShowEditProfile(true);
  };

  const handleProfileUpdated = (updatedUser) => {
    updateUser(updatedUser);
    //setShowEditProfile(false);
  };

  if (loading) {
    return (
      <Page title="Profile">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="bodyMd">Loading profile...</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!isAuthenticated() || !user) {
    return (
      <Page title="Profile">
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              <p>Please sign in to view your profile.</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="My Profile">
      <Layout>
        {/* User Information */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Personal Information
              </Text>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  <strong>Name:</strong> {user.full_name}
                </Text>
                
                <Text variant="bodyMd" as="p">
                  <strong>Email:</strong> {user.email}
                </Text>
                
                {/* CAMPOS PROFESIONALES NUEVOS */}
                {user.phone && (
                  <Text variant="bodyMd" as="p">
                    <strong>Phone:</strong> {user.phone}
                  </Text>
                )}
                
                {user.address && (
                  <Text variant="bodyMd" as="p">
                    <strong>Address:</strong> {user.address}
                    {user.city && `, ${user.city}`}
                    {user.state && `, ${user.state}`}
                    {user.postal_code && ` ${user.postal_code}`}
                    {user.country && `, ${user.country}`}
                  </Text>
                )}
                
                {user.company_name && (
                  <Text variant="bodyMd" as="p">
                    <strong>Company:</strong> {user.company_name}
                  </Text>
                )}
                
                {user.tax_id && (
                  <Text variant="bodyMd" as="p">
                    <strong>Tax ID:</strong> {user.tax_id}
                  </Text>
                )}
                
                <Text variant="bodyMd" as="p">
                  <strong>Account Type:</strong> {user.is_admin ? 'Administrator' : 'Customer'}
                </Text>
                
                <Text variant="bodyMd" as="p">
                  <strong>Status:</strong> {user.is_active ? 'Active' : 'Inactive'}
                </Text>
                
                {user.created_at && (
                  <Text variant="bodyMd" as="p">
                    <strong>Member since:</strong> {new Date(user.created_at).toLocaleDateString()}
                  </Text>
                )}
              </BlockStack>

              {/* BOTONES CENTRADOS */}
              <InlineStack gap="300" align="center">
                <Button onClick={handleEditProfile}>
                  Edit Profile
                </Button>
                <Button variant="primary" tone="critical" onClick={handleLogout}>
                  Sign Out
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section variant="oneHalf">
          <BlockStack gap="400">
            {/* Shopping Actions */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Quick Actions
                </Text>
                
                <BlockStack gap="200">
                  <Button 
                    fullWidth 
                    onClick={() => navigate('/products')}
                  >
                    Browse Products
                  </Button>
                  
                  <Button 
                    fullWidth 
                    onClick={() => navigate('/cart')}
                  >
                    View Cart
                  </Button>
                  
                  <Button 
                    fullWidth 
                    onClick={() => setShowOrderHistory(true)}
                  >
                    Order History
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Admin Actions - Simplificado */}
            {user.is_admin && (
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    👑 Admin Access
                  </Text>
                  
                  <Button 
                    fullWidth 
                    variant="primary"
                    onClick={() => navigate('/admin')}
                  >
                    Go to Admin Dashboard
                  </Button>
                </BlockStack>
              </Card>
            )}

            {/* Account Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Account Settings
                </Text>
                
                <BlockStack gap="200">
                  <Button 
                    fullWidth 
                    onClick={() => setShowChangePassword(true)}
                  >
                    Change Password
                  </Button>
                  
                  <Button 
                    fullWidth 
                    onClick={() => setNotificationModalOpen(true)}
                  >
                    Notification Settings
                  </Button>
                  
                  <Button 
                   fullWidth 
                   variant="primary"
                   tone="critical"
                   onClick={() => setDeleteAccountModalOpen(true)}
                  >
                    Delete Account
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Order History Modal */}
      <Modal
        open={showOrderHistory}
        onClose={() => setShowOrderHistory(false)}
        title="Order History"
        size="large"
        sectioned
      >
        <Modal.Section>
          <OrderHistory />
        </Modal.Section>
      </Modal>
      
      {/* Edit Profile Modal */}
      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        user={user}
        onSuccess={handleProfileUpdated}
      />
      
      {/* Change Password Modal */}
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
      
      {/* Notification Settings Modal */}
      <NotificationSettings
        open={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        user={user}
      />
      
      {/* Delete Account Modal */}
      <DeleteAccountModal
        open={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
      />
    </Page>
  );
}

export default Profile;