import React, { useState } from 'react';
import {
  Page,
  Layout,
  Card,
  Tabs,
  Badge,
  Text,
  BlockStack
} from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';
import Analytics from '../components/admin/Analytics';
import ManageProducts from '../components/admin/ManageProducts';
import AdminOrders from '../components/AdminOrders';
import ManageInvoices from '../components/admin/ManageInvoices';
import ManageCoupons from '../components/admin/ManageCoupons';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState(0);

  // Verificar si es admin
  if (!user || !user.is_admin) {
    return (
      <Page title="Access Denied">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2" alignment="center">
                  Access Denied
                </Text>
                <Text alignment="center">
                  You don't have permission to access this page. Admin privileges are required.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const tabs = [
    {
      id: 'analytics',
      content: 'Analytics',
      badge: <Badge tone="info">Active</Badge>,
      accessibilityLabel: 'View analytics and reports',
      panelID: 'analytics-panel',
    },
    {
      id: 'products',
      content: 'Products',
      accessibilityLabel: 'Manage products',
      panelID: 'products-panel',
    },
    {
      id: 'orders',
      content: 'Orders',
      accessibilityLabel: 'View and manage orders',
      panelID: 'orders-panel',
    },
    {
      id: 'invoices',
      content: 'Invoices',
      accessibilityLabel: 'Generate and manage invoices',
      panelID: 'invoices-panel',
    },
    {
      id: 'coupons',
      content: 'Coupons',
      badge: <Badge tone="attention">New</Badge>,
      accessibilityLabel: 'Manage discount coupons',
      panelID: 'coupons-panel',
    },
    {
      id: 'users',
      content: 'Users',
      badge: <Badge>Soon</Badge>,
      accessibilityLabel: 'Manage users',
      panelID: 'users-panel',
      disabled: true,
    },
  ];

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0:
        return <Analytics />;
      case 1:
        return <ManageProducts />;
      case 2:
        return <AdminOrders />;
      case 3:
        return <ManageInvoices />;
      case 4:
        return <ManageCoupons />;
      case 5:
        return (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2" alignment="center">
                User Management
              </Text>
              <Text alignment="center" tone="subdued">
                User management functionality will be implemented in the next update.
              </Text>
            </BlockStack>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <Page 
      title="Admin Dashboard"
      subtitle={`Welcome back, ${user.username}!`}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Tabs
              tabs={tabs}
              selected={selectedTab}
              onSelect={setSelectedTab}
              fitted
            >
              <div style={{ 
                padding: selectedTab === 0 ? '0' : 
                         (selectedTab === 1 || selectedTab === 2) ? '0' : 
                         '16px' 
              }}>
                {renderTabContent()}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default AdminDashboard;