import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Page,
  Card,
  DataTable,
  Button,
  Badge,
  Modal,
  FormLayout,
  TextField,
  Select,
  InlineStack,
  BlockStack,
  Text,
  Banner,
  Spinner,
  EmptyState,
  Filters,
  ChoiceList,
  Checkbox,
  Pagination
} from '@shopify/polaris';
import {
  ReceiptIcon,
  ExportIcon,
  EditIcon,
  DeleteIcon,
  PlusIcon
} from '@shopify/polaris-icons';
import { getData } from 'country-list';

// Get country list from package
const countryList = getData().map(country => ({
  label: country.name,
  value: country.code
}));

const ManageInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // Store ALL orders
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState([]);
  
  // Modals
  const [createModalActive, setCreateModalActive] = useState(false);
  const [editModalActive, setEditModalActive] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [isCompanyInvoice, setIsCompanyInvoice] = useState(false);
  
  // Invoice settings modal
  const [settingsModalActive, setSettingsModalActive] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  
  // Form data with all fields
  const [formData, setFormData] = useState({
    tax_rate: 21,
    shipping_cost: 0,
    discount_amount: 0,
    notes: '',
    billing_name: '',
    billing_tax_id: '',
    billing_phone: '',
    billing_address: '',
    billing_city: '',
    billing_postal_code: '',
    billing_country: 'ES',
    status: 'pending',
    payment_method: 'stripe'
  });

  // LOCAL state for modal fields to fix Polaris TextField update issues
  const [localFormData, setLocalFormData] = useState({});

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ecommerce-jwt-token');
      
      let url = `${process.env.REACT_APP_API_URL}/api/admin/invoices?page=${currentPage}`;
      
      // Add filters
      if (statusFilter.length > 0) {
        url += `&status=${statusFilter[0]}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      
      const data = await response.json();
      setInvoices(data.invoices || []);
      setTotalPages(data.pages || 1);
      setTotalInvoices(data.total || 0);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);
  
  // Fetch ALL orders and compute available ones
  const fetchOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/orders/admin/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      // Store ALL orders for data access
      setAllOrders(data.orders || []);
      
      // Filter orders without invoices for display
      const ordersWithoutInvoices = (data.orders || []).filter(order => {
        return !invoices.some(invoice => invoice.order_id === order.id);
      });
      
      setOrders(ordersWithoutInvoices);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to fetch orders');
    }
  }, [invoices]);
  
  // Fetch invoice settings
  const fetchInvoiceSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/invoice-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const data = await response.json();
      setInvoiceSettings(data);
      setFormData(prev => ({
        ...prev,
        tax_rate: data.default_tax_rate || 21
      }));
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, []);
  
  useEffect(() => {
    fetchInvoices();
    fetchInvoiceSettings();
  }, [fetchInvoices, fetchInvoiceSettings]);
  
  useEffect(() => {
    if (!loading) {
      fetchOrders();
    }
  }, [loading, fetchOrders]);
  
  // Create invoice
  const handleCreateInvoice = async () => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/admin/invoices/create/${selectedOrderId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice');
      }
      
      setSuccess('Invoice created successfully');
      setCreateModalActive(false);
      fetchInvoices();
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };
  
  // Update invoice
  const handleUpdateInvoice = async () => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/admin/invoices/${selectedInvoice.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            status: formData.status,
            notes: formData.notes,
            payment_method: formData.payment_method
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to update invoice');
      }
      
      setSuccess('Invoice updated successfully');
      setEditModalActive(false);
      fetchInvoices();
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };
  
  // Delete (cancel) invoice
  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to cancel this invoice?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/admin/invoices/${invoiceId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to cancel invoice');
      }
      
      setSuccess('Invoice cancelled successfully');
      fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };
  
  // Download invoice PDF
  const handleDownloadInvoice = async (invoiceId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/admin/invoices/${invoiceId}/download`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download invoice');
    }
  };
  
  // Update invoice settings
  const handleUpdateSettings = async (settingsData) => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/admin/invoice-settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(settingsData)
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      
      setSuccess('Settings updated successfully');
      setSettingsModalActive(false);
      fetchInvoiceSettings();
    } catch (err) {
      setError(err.message);
    }
  };
  
  // Handle order selection and auto-fill form
  const handleOrderSelection = (value) => {
    setSelectedOrderId(value);
    
    if (!value) {
      resetForm();
      return;
    }
    
    // Find the order from ALL orders, not just filtered ones
    const selectedOrder = allOrders.find(o => o.id.toString() === value);
    
    if (selectedOrder && selectedOrder.user) {
      const user = selectedOrder.user;
      
      // Auto-check if user has company
      const hasCompany = !!(user.company_name && user.company_name.trim());
      setIsCompanyInvoice(hasCompany);
      
      // Pre-fill form with user data
      const fullName = (user.first_name || '') + ' ' + (user.last_name || '');
      const displayName = fullName.trim() || user.username || 'Guest';
      
      // Update BOTH states - main and local for TextFields
      const newData = {
        tax_rate: invoiceSettings?.default_tax_rate || 21,
        shipping_cost: 0,
        discount_amount: 0,
        notes: '',
        billing_name: hasCompany ? user.company_name : displayName,
        billing_tax_id: hasCompany ? (user.tax_id || '') : '',
        billing_phone: user.phone || '',
        billing_address: user.billing_address || user.address || '',
        billing_city: user.city || '',
        billing_postal_code: user.postal_code || '',
        billing_country: user.country || 'ES',
        status: 'pending',
        payment_method: 'stripe'
      };
      
      // Update both states
      setFormData(newData);
      setLocalFormData(newData);
    }
  };
  
  const resetForm = () => {
    setFormData({
      tax_rate: invoiceSettings?.default_tax_rate || 21,
      shipping_cost: 0,
      discount_amount: 0,
      notes: '',
      billing_name: '',
      billing_tax_id: '',
      billing_phone: '',
      billing_address: '',
      billing_city: '',
      billing_postal_code: '',
      billing_country: 'ES',
      status: 'pending',
      payment_method: 'stripe'
    });
    setLocalFormData({}); // Reset local state too
    setSelectedOrderId('');
    setSelectedInvoice(null);
    setIsCompanyInvoice(false);
  };
  
  // Get status badge
  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { tone: 'warning', label: 'Pending' },
      'paid': { tone: 'success', label: 'Paid' },
      'cancelled': { tone: 'critical', label: 'Cancelled' },
      'refunded': { tone: 'info', label: 'Refunded' }
    };
    
    const config = statusMap[status] || { tone: 'default', label: status };
    return <Badge tone={config.tone}>{config.label}</Badge>;
  };
  
  // Format currency - FIXED to always use EUR
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  // Prepare table rows
  const rows = invoices.map(invoice => [
    invoice.invoice_number,
    new Date(invoice.issue_date).toLocaleDateString(),
    invoice.billing_name || 'N/A',
    formatCurrency(invoice.total_amount),
    getStatusBadge(invoice.status),
    <InlineStack gap="2">
      <Button
        size="slim"
        icon={ExportIcon}
        onClick={() => handleDownloadInvoice(invoice.id, invoice.invoice_number)}
      />
      <Button
        size="slim"
        icon={EditIcon}
        onClick={() => {
          setSelectedInvoice(invoice);
          setFormData({
            ...formData,
            status: invoice.status,
            notes: invoice.notes || '',
            payment_method: invoice.payment_method || ''
          });
          setEditModalActive(true);
        }}
      />
      {invoice.status !== 'cancelled' && (
        <Button
          size="slim"
          tone="critical"
          icon={DeleteIcon}
          onClick={() => handleDeleteInvoice(invoice.id)}
        />
      )}
    </InlineStack>
  ]);
  
  return (
    <Page
      title="Manage Invoices"
      primaryAction={{
        content: 'Create Invoice',
        icon: PlusIcon,
        onAction: () => setCreateModalActive(true),
        disabled: orders.length === 0
      }}
      secondaryActions={[
        {
          content: 'Invoice Settings',
          onAction: () => setSettingsModalActive(true)
        }
      ]}
    >
      {error && (
        <Banner
          title="Error"
          tone="critical"
          onDismiss={() => setError(null)}
        >
          <p>{error}</p>
        </Banner>
      )}
      
      {success && (
        <Banner
          title="Success"
          tone="success"
          onDismiss={() => setSuccess(null)}
        >
          <p>{success}</p>
        </Banner>
      )}
      
      <BlockStack gap="4">
        <Card>
          <BlockStack gap="4">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">
                Total Invoices: {totalInvoices}
              </Text>
              
              <Filters
                queryValue=""
                filters={[
                  {
                    key: 'status',
                    label: 'Status',
                    filter: (
                      <ChoiceList
                        title="Status"
                        titleHidden
                        choices={[
                          { label: 'Pending', value: 'pending' },
                          { label: 'Paid', value: 'paid' },
                          { label: 'Cancelled', value: 'cancelled' },
                          { label: 'Refunded', value: 'refunded' }
                        ]}
                        selected={statusFilter}
                        onChange={setStatusFilter}
                      />
                    )
                  }
                ]}
                onClearAll={() => {
                  setStatusFilter([]);
                }}
              />
            </InlineStack>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Spinner size="large" />
              </div>
            ) : invoices.length === 0 ? (
              <EmptyState
                heading="No invoices found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{ content: 'Create first invoice', onAction: () => setCreateModalActive(true) }}
              >
                <p>Create invoices from completed orders.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={[
                  'Invoice #',
                  'Date',
                  'Customer',
                  'Total',
                  'Status',
                  'Actions'
                ]}
                rows={rows}
                footerContent={
                  totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                      <Pagination
                        hasPrevious={currentPage > 1}
                        onPrevious={() => setCurrentPage(currentPage - 1)}
                        hasNext={currentPage < totalPages}
                        onNext={() => setCurrentPage(currentPage + 1)}
                        label={`${currentPage} / ${totalPages}`}
                      />
                    </div>
                  )
                }
              />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
      
      {/* Create Invoice Modal - WITH KEY FOR RE-RENDER */}
      <Modal
        key={`create-invoice-${selectedOrderId}-${createModalActive}`}
        open={createModalActive}
        onClose={() => {
          setCreateModalActive(false);
          resetForm();
        }}
        title="Create Invoice"
        primaryAction={{
          content: 'Create',
          onAction: handleCreateInvoice,
          disabled: !selectedOrderId
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setCreateModalActive(false);
              resetForm();
            }
          }
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <Select
              label="Order"
              options={[
                { label: 'Select an order', value: '' },
                ...orders.map(order => {
                  const user = order.user || {};
                  const fullName = (user.first_name || '') + ' ' + (user.last_name || '');
                  const displayName = fullName.trim() || user.username || 'Guest';
                  
                  return {
                    label: `Order #${order.id} - ${displayName} - ${formatCurrency(order.total_amount)}`,
                    value: order.id.toString()
                  };
                })
              ]}
              value={selectedOrderId}
              onChange={handleOrderSelection}
              error={!selectedOrderId && 'Please select an order'}
            />
            
            <Checkbox
              label="Invoice to company"
              checked={isCompanyInvoice}
              onChange={(value) => {
                setIsCompanyInvoice(value);
                
                // Update billing name when toggling
                const selectedOrder = allOrders.find(o => o.id.toString() === selectedOrderId);
                if (selectedOrder && selectedOrder.user) {
                  const user = selectedOrder.user;
                  const fullName = (user.first_name || '') + ' ' + (user.last_name || '');
                  const displayName = fullName.trim() || user.username || 'Guest';
                  
                  // Update both states when toggling company checkbox
                  const updatedData = {
                    ...localFormData,
                    billing_name: value && user.company_name ? user.company_name : displayName,
                    billing_tax_id: value && user.tax_id ? user.tax_id : ''
                  };
                  setLocalFormData(updatedData);
                  setFormData({ ...formData, ...updatedData });
                }
              }}
            />
            
            <TextField
              key={`billing_name_${selectedOrderId}`}
              label="Billing Name"
              value={localFormData.billing_name || ''}
              onChange={(value) => {
                setLocalFormData({ ...localFormData, billing_name: value });
                setFormData({ ...formData, billing_name: value });
              }}
              helpText={isCompanyInvoice ? "Company name for invoice" : "Customer name for invoice"}
            />
            
            {isCompanyInvoice && (
              <TextField
                key={`billing_tax_id_${selectedOrderId}`}
                label="Tax ID / VAT"
                value={localFormData.billing_tax_id || ''}
                onChange={(value) => {
                  setLocalFormData({ ...localFormData, billing_tax_id: value });
                  setFormData({ ...formData, billing_tax_id: value });
                }}
                helpText="Company tax identification number"
              />
            )}
            
            <TextField
              key={`billing_phone_${selectedOrderId}`}
              label="Phone"
              value={localFormData.billing_phone || ''}
              onChange={(value) => {
                setLocalFormData({ ...localFormData, billing_phone: value });
                setFormData({ ...formData, billing_phone: value });
              }}
            />
            
            <TextField
              key={`tax_rate_${selectedOrderId}`}
              label="Tax Rate (%)"
              type="number"
              value={(localFormData.tax_rate || 21).toString()}
              onChange={(value) => {
                const rate = parseFloat(value) || 0;
                setLocalFormData({ ...localFormData, tax_rate: rate });
                setFormData({ ...formData, tax_rate: rate });
              }}
            />
            
            <TextField
              key={`shipping_cost_${selectedOrderId}`}
              label="Shipping Cost"
              type="number"
              value={(localFormData.shipping_cost || 0).toString()}
              onChange={(value) => {
                const cost = parseFloat(value) || 0;
                setLocalFormData({ ...localFormData, shipping_cost: cost });
                setFormData({ ...formData, shipping_cost: cost });
              }}
              prefix="€"
            />
            
            <TextField
              key={`discount_amount_${selectedOrderId}`}
              label="Discount Amount"
              type="number"
              value={(localFormData.discount_amount || 0).toString()}
              onChange={(value) => {
                const discount = parseFloat(value) || 0;
                setLocalFormData({ ...localFormData, discount_amount: discount });
                setFormData({ ...formData, discount_amount: discount });
              }}
              prefix="€"
            />
            
            <TextField
              key={`billing_address_${selectedOrderId}`}
              label="Billing Address"
              value={localFormData.billing_address || ''}
              onChange={(value) => {
                setLocalFormData({ ...localFormData, billing_address: value });
                setFormData({ ...formData, billing_address: value });
              }}
            />
            
            <InlineStack gap="4">
              <TextField
                key={`billing_city_${selectedOrderId}`}
                label="City"
                value={localFormData.billing_city || ''}
                onChange={(value) => {
                  setLocalFormData({ ...localFormData, billing_city: value });
                  setFormData({ ...formData, billing_city: value });
                }}
              />
              
              <TextField
                key={`billing_postal_code_${selectedOrderId}`}
                label="Postal Code"
                value={localFormData.billing_postal_code || ''}
                onChange={(value) => {
                  setLocalFormData({ ...localFormData, billing_postal_code: value });
                  setFormData({ ...formData, billing_postal_code: value });
                }}
              />
            </InlineStack>
            
            <Select
              key={`billing_country_${selectedOrderId}`}
              label="Country"
              options={countryList}
              value={localFormData.billing_country || 'ES'}
              onChange={(value) => {
                setLocalFormData({ ...localFormData, billing_country: value });
                setFormData({ ...formData, billing_country: value });
              }}
            />
            
            <TextField
              key={`notes_${selectedOrderId}`}
              label="Notes"
              multiline={4}
              value={localFormData.notes || ''}
              onChange={(value) => {
                setLocalFormData({ ...localFormData, notes: value });
                setFormData({ ...formData, notes: value });
              }}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
      
      {/* Edit Invoice Modal */}
      <Modal
        open={editModalActive}
        onClose={() => {
          setEditModalActive(false);
          resetForm();
        }}
        title={`Edit Invoice ${selectedInvoice?.invoice_number || ''}`}
        primaryAction={{
          content: 'Update',
          onAction: handleUpdateInvoice
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setEditModalActive(false);
              resetForm();
            }
          }
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <Select
              label="Status"
              options={[
                { label: 'Pending', value: 'pending' },
                { label: 'Paid', value: 'paid' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Refunded', value: 'refunded' }
              ]}
              value={formData.status}
              onChange={(value) => setFormData({ ...formData, status: value })}
            />
            
            <TextField
              label="Payment Method"
              value={formData.payment_method}
              onChange={(value) => setFormData({ ...formData, payment_method: value })}
            />
            
            <TextField
              label="Notes"
              multiline={4}
              value={formData.notes}
              onChange={(value) => setFormData({ ...formData, notes: value })}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
      
      {/* Invoice Settings Modal */}
      {invoiceSettings && (
        <Modal
          open={settingsModalActive}
          onClose={() => setSettingsModalActive(false)}
          title="Invoice Settings"
          primaryAction={{
            content: 'Save Settings',
            onAction: () => handleUpdateSettings(invoiceSettings)
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setSettingsModalActive(false)
            }
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Company Name"
                value={invoiceSettings.company_name || ''}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, company_name: value })}
              />
              
              <TextField
                label="Tax ID"
                value={invoiceSettings.company_tax_id || ''}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, company_tax_id: value })}
              />
              
              <TextField
                label="Company Email"
                type="email"
                value={invoiceSettings.company_email || ''}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, company_email: value })}
              />
              
              <TextField
                label="Company Phone"
                value={invoiceSettings.company_phone || ''}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, company_phone: value })}
              />
              
              <TextField
                label="Address"
                value={invoiceSettings.company_address || ''}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, company_address: value })}
              />
              
              <InlineStack gap="4">
                <TextField
                  label="City"
                  value={invoiceSettings.company_city || ''}
                  onChange={(value) => setInvoiceSettings({ ...invoiceSettings, company_city: value })}
                />
                
                <TextField
                  label="Postal Code"
                  value={invoiceSettings.company_postal_code || ''}
                  onChange={(value) => setInvoiceSettings({ ...invoiceSettings, company_postal_code: value })}
                />
              </InlineStack>
              
              <TextField
                label="Invoice Prefix"
                value={invoiceSettings.invoice_prefix || ''}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, invoice_prefix: value })}
              />
              
              <TextField
                label="Default Tax Rate (%)"
                type="number"
                value={(invoiceSettings.default_tax_rate || 21).toString()}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, default_tax_rate: parseFloat(value) || 0 })}
              />
              
              <Select
                label="Default Currency"
                options={[
                  { label: 'EUR', value: 'EUR' },
                  { label: 'USD', value: 'USD' },
                  { label: 'GBP', value: 'GBP' }
                ]}
                value={invoiceSettings.default_currency || 'EUR'}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, default_currency: value })}
              />
              
              <TextField
                label="Payment Terms (days)"
                type="number"
                value={(invoiceSettings.payment_terms_days || 30).toString()}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, payment_terms_days: parseInt(value) || 30 })}
              />
              
              <TextField
                label="Terms & Conditions"
                multiline={4}
                value={invoiceSettings.terms_conditions || ''}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, terms_conditions: value })}
              />
              
              <TextField
                label="Footer Text"
                multiline={2}
                value={invoiceSettings.footer_text || ''}
                onChange={(value) => setInvoiceSettings({ ...invoiceSettings, footer_text: value })}
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
};

export default ManageInvoices;