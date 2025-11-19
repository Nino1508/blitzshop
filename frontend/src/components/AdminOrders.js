import React, { useState, useEffect } from 'react';
import {
  Page,
  Card,
  DataTable,
  Badge,
  Button,
  Select,
  TextField,
  BlockStack,
  InlineStack,
  Text,
  Modal,
  Spinner,
  Pagination
} from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AdminOrders = () => {
  const { getAuthToken } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, currentPage]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/api/orders/admin/all?page=${currentPage}&limit=${itemsPerPage}`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      
      const data = await response.json();
      setOrders(data.items || []);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const statusOptions = [
    {label: 'All', value: 'all'},
    {label: 'Pending', value: 'pending'},
    {label: 'Paid', value: 'paid'},
    {label: 'Processing', value: 'processing'},
    {label: 'Shipped', value: 'shipped'},
    {label: 'Delivered', value: 'delivered'},
    {label: 'Cancelled', value: 'cancelled'}
  ];

  const getStatusBadge = (status) => {
    const tones = {
      pending: 'attention',
      paid: 'success',
      processing: 'info',
      shipped: 'info',
      delivered: 'success',
      cancelled: 'critical'
    };
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    return <Badge tone={tones[status] || 'default'}>{displayStatus}</Badge>;
  };

  const filteredOrders = orders.filter(order => 
    searchTerm === '' || 
    order.id.toString().includes(searchTerm) ||
    order.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const rows = filteredOrders.map(order => [
    `#${order.id}`,
    order.email || 'N/A',
    `€${order.total_amount}`,
    getStatusBadge(order.status),
    new Date(order.created_at).toLocaleDateString(),
    <InlineStack gap="200">
      <Button size="slim" onClick={() => {
        setSelectedOrder(order);
        setShowDetails(true);
      }}>View</Button>
      <Select
        label=""
        labelHidden
        options={statusOptions.filter(o => o.value !== 'all')}
        value={order.status}
        onChange={(value) => updateOrderStatus(order.id, value)}
      />
    </InlineStack>
  ]);

  if (loading) {
    return (
      <Page title="All Orders">
        <Card>
          <BlockStack gap="400" align="center">
            <Spinner size="large" />
            <Text>Loading orders...</Text>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="All Orders">
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="400" align="space-between">
            <TextField
              label=""
              labelHidden
              placeholder="Search by Order ID or Email"
              value={searchTerm}
              onChange={setSearchTerm}
              clearButton
              onClearButtonClick={() => setSearchTerm('')}
            />
            <Select
              label=""
              labelHidden
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </InlineStack>

          <DataTable
            columnContentTypes={['text', 'text', 'numeric', 'text', 'text', 'text']}
            headings={['Order ID', 'Customer', 'Total', 'Status', 'Date', 'Actions']}
            rows={rows}
          />

          {/* Pagination */}
          {filteredOrders.length > 0 && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <Pagination
                hasPrevious={currentPage > 1}
                onPrevious={() => setCurrentPage(currentPage - 1)}
                hasNext={currentPage < totalPages}
                onNext={() => setCurrentPage(currentPage + 1)}
                label={`${currentPage} / ${totalPages}`}
              />
            </div>
          )}
        </BlockStack>
      </Card>

      {/* Order Details Modal */}
      {showDetails && selectedOrder && (
        <Modal
          open={showDetails}
          onClose={() => setShowDetails(false)}
          title={`Order #${selectedOrder.id}`}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text><strong>Customer:</strong> {selectedOrder.email}</Text>
              <Text><strong>Total:</strong> €{selectedOrder.total_amount}</Text>
              <Text><strong>Status:</strong> {selectedOrder.status}</Text>
              <Text><strong>Date:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</Text>
              {selectedOrder.shipping_address && (
                <Text><strong>Shipping:</strong> {selectedOrder.shipping_address}</Text>
              )}
              {selectedOrder.items && (
                <>
                  <Text variant="headingSm">Items:</Text>
                  {selectedOrder.items.map(item => (
                    <Text key={item.id}>
                      {item.product_name} x {item.quantity} = €{item.total_price}
                    </Text>
                  ))}
                </>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
};

export default AdminOrders;