import React, { useState, useEffect } from 'react';
import {
  Card,
  DataTable,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Thumbnail,
  Text,
  Spinner,
  EmptyState,
  Collapsible,
  Divider
} from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const { getAuthToken } = useAuth();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/users/orders`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.orders);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderExpanded = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { tone: 'attention', children: 'Pending' },
      'paid': { tone: 'success', children: 'Paid' },
      'processing': { tone: 'info', children: 'Processing' },
      'shipped': { tone: 'info', children: 'Shipped' },
      'delivered': { tone: 'success', children: 'Delivered' },
      'cancelled': { tone: 'critical', children: 'Cancelled' }
    };

    const config = statusMap[status] || { tone: 'info', children: status };
    return <Badge {...config} />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <BlockStack gap="400" align="center">
          <Spinner size="large" />
          <Text as="p" variant="bodyMd">Loading your orders...</Text>
        </BlockStack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="critical">Error: {error}</Text>
          <Button onClick={fetchOrders}>Try Again</Button>
        </BlockStack>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState
          heading="No orders yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>When you make your first purchase, it will appear here.</p>
        </EmptyState>
      </Card>
    );
  }

  return (
    <BlockStack gap="400">
      <Text as="h2" variant="headingLg">Order History</Text>
      
      {orders.map(order => (
        <Card key={order.id}>
          <BlockStack gap="400">
            {/* Order Header */}
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Order #{order.order_number || order.id}
                </Text>
                <InlineStack gap="400">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {formatDate(order.created_at)}
                  </Text>
                  {getStatusBadge(order.status)}
                </InlineStack>
              </BlockStack>
              
              <BlockStack gap="200" align="end">
                <Text as="p" variant="headingMd">
                  {formatCurrency(order.total_amount)}
                </Text>
                <Button 
                  onClick={() => toggleOrderExpanded(order.id)}
                  disclosure={expandedOrders[order.id] ? 'up' : 'down'}
                >
                  {expandedOrders[order.id] ? 'Hide' : 'Show'} Details
                </Button>
              </BlockStack>
            </InlineStack>

            {/* Order Details - Collapsible */}
            <Collapsible
              open={expandedOrders[order.id]}
              id={`order-${order.id}`}
              transition={{duration: '200ms', timingFunction: 'ease-in-out'}}
            >
              <BlockStack gap="400">
                <Divider />
                
                {/* Order Items */}
                <BlockStack gap="300">
                  <Text as="h4" variant="headingSm">Items ({order.items_count})</Text>
                  
                  {order.items && order.items.map(item => (
                    <InlineStack key={item.id} gap="400" align="space-between">
                      <InlineStack gap="400">
                        {item.product_image_url && (
                          <Thumbnail
                            source={item.product_image_url}
                            alt={item.product_name}
                            size="small"
                          />
                        )}
                        <BlockStack gap="100">
                          <Text as="p" variant="bodyMd" fontWeight="semibold">
                            {item.product_name}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            Quantity: {item.quantity} × {formatCurrency(item.price)}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        {formatCurrency(item.total)}
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>

                <Divider />

                {/* Order Info */}
                <BlockStack gap="200">
                  <Text as="h4" variant="headingSm">Order Information</Text>
                  
                  {order.shipping_address && (
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" fontWeight="semibold">Shipping Address:</Text>
                      <Text as="p" variant="bodySm" tone="subdued">{order.shipping_address}</Text>
                    </BlockStack>
                  )}
                  
                  {order.billing_address && (
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" fontWeight="semibold">Billing Address:</Text>
                      <Text as="p" variant="bodySm" tone="subdued">{order.billing_address}</Text>
                    </BlockStack>
                  )}
                  
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="semibold">Payment Method:</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{order.payment_method}</Text>
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>
      ))}
    </BlockStack>
  );
};

export default OrderHistory;