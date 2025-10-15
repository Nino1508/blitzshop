// frontend/src/pages/Checkout.js
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Page, Card, Button, Banner, Spinner, BlockStack, InlineStack, Text, Divider } from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';
import CouponInput from '../components/CouponInput';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Your Stripe public key
const stripePromise = loadStripe('pk_test_51RvJEnAqoyGnpREmRiEBoqyrP4n1Kc4gJb5bLn52EQVQNw1UZ36aw5nEbrKmB687SVHTtJSfZeWvFRKedxLBbx2h00PML3njPq');

// Componente de formulario de pago
const PaymentForm = ({ order, finalTotal, onPaymentSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { getAuthToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);

  // Crear Payment Intent al cargar
  useEffect(() => {
    if (order) {
      createPaymentIntent();
    }
  }, [order, finalTotal]);

  const createPaymentIntent = async () => {
    try {
      const response = await fetch(`${API_URL}/api/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          order_id: order.id,
          amount: finalTotal // Usar el total con descuento
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.client_secret);
    } catch (err) {
      setError('Error setting up payment. Please try again.');
      console.error('Payment intent error:', err);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Confirmar pago con Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          }
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      // Confirmar pago en nuestro backend
      const confirmResponse = await fetch(`${API_URL}/api/payments/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id
        })
      });

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm payment');
      }

      const confirmData = await confirmResponse.json();
      onPaymentSuccess(confirmData.order);

    } catch (err) {
      setError('Payment failed. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!clientSecret) {
    return (
      <Card sectioned>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <Spinner size="large" />
          <p>Setting up payment...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card sectioned>
      <form onSubmit={handleSubmit}>
        <BlockStack gap="400">
          <div style={{ padding: '16px', border: '1px solid #e1e3e5', borderRadius: '4px' }}>
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
              }}
            />
          </div>
          
          {error && (
            <Banner status="critical">
              {error}
            </Banner>
          )}
          
          <Button
            primary
            submit
            loading={loading}
            disabled={!stripe || loading}
            size="large"
          >
            {loading ? 'Processing...' : `Pay €${finalTotal.toFixed(2)}`}
          </Button>
        </BlockStack>
      </form>
    </Card>
  );
};

// Componente principal de Checkout
const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getAuthToken } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  // Estados para cupones
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [finalTotal, setFinalTotal] = useState(0);

  const orderId = searchParams.get('order_id');

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    } else {
      setError('No order ID provided');
      setLoading(false);
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Order not found');
      }

      const data = await response.json();
      setOrder(data.order);
      setFinalTotal(data.order.final_amount || data.order.total_amount);
      
      // If order already has a coupon applied
      if (data.order.coupon_code) {
        setAppliedCoupon({
          code: data.order.coupon_code,
          discount_amount: data.order.discount_amount || 0,
          final_total: data.order.final_amount || data.order.total_amount
        });
      }
    } catch (err) {
      setError('Failed to load order');
      console.error('Order fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle coupon application
  const handleCouponApplied = async (coupon) => {
    try {
      // Apply coupon to existing order
      const response = await fetch(`${API_URL}/api/coupons/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          code: coupon.code,
          order_id: order.id,
          cart_total: order.total_amount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to apply coupon');
      }

      const data = await response.json();
      
      // Actualizar la orden con el descuento
      setAppliedCoupon(coupon);
      setFinalTotal(data.final_total);
      
      // Actualizar la orden en el estado
      const updatedOrder = {
        ...order,
        coupon_code: coupon.code,
        discount_amount: data.discount_applied,
        final_amount: data.final_total
      };
      setOrder(updatedOrder);
      
      // Actualizar en el backend
      await fetch(`${API_URL}/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          coupon_code: coupon.code,
          discount_amount: data.discount_applied,
          final_amount: data.final_total
        })
      });
      
    } catch (err) {
      console.error('Error applying coupon:', err);
      alert(err.message);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setFinalTotal(order.total_amount);
    
    // Actualizar la orden para quitar el cupón
    setOrder({
      ...order,
      coupon_code: null,
      discount_amount: 0,
      final_amount: order.total_amount
    });
    
    // Actualizar en el backend
    fetch(`${API_URL}/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        coupon_code: null,
        discount_amount: 0,
        final_amount: order.total_amount
      })
    });
  };

  const handlePaymentSuccess = (updatedOrder) => {
    setOrder(updatedOrder);
    setPaymentSuccess(true);
  };

  if (loading) {
    return (
      <Page title="Checkout">
        <Card sectioned>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <Spinner size="large" />
            <p>Loading order...</p>
          </div>
        </Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Checkout">
        <Banner status="critical">
          {error}
        </Banner>
      </Page>
    );
  }

  if (paymentSuccess) {
    return (
      <Page title="Payment Successful">
        <BlockStack gap="400">
          <Banner tone="success">
            <p>Payment completed successfully! Order #{order.id} has been confirmed.</p>
          </Banner>
          
          <Card sectioned title="Order Summary">
            <BlockStack gap="200">
              <p><strong>Order ID:</strong> #{order.id}</p>
              <p><strong>Status:</strong> {order.status}</p>
              {appliedCoupon && (
                <>
                  <p><strong>Subtotal:</strong> €{order.total_amount}</p>
                  <p><strong>Discount ({appliedCoupon.code}):</strong> -€{order.discount_amount}</p>
                  <p><strong>Total Paid:</strong> €{order.final_amount || finalTotal}</p>
                </>
              )}
              {!appliedCoupon && (
                <p><strong>Total:</strong> €{order.total_amount}</p>
              )}
              <p><strong>Items:</strong></p>
              {order.items?.map((item, index) => (
                <div key={index} style={{ marginLeft: '20px' }}>
                  • {item.product_name} x {item.quantity} = €{item.total_price}
                </div>
              ))}
            </BlockStack>
          </Card>
          
          <Button onClick={() => navigate('/products')}>
            Continue Shopping
          </Button>
        </BlockStack>
      </Page>
    );
  }

  return (
    <Page title="Checkout">
      <BlockStack gap="400">
        <Card sectioned title="Order Summary">
          <BlockStack gap="200">
            <p><strong>Order ID:</strong> #{order.id}</p>
            <p><strong>Subtotal:</strong> €{order.total_amount}</p>
            
            {appliedCoupon && (
              <>
                <Divider />
                <InlineStack align="space-between">
                  <Text>Discount ({appliedCoupon.code})</Text>
                  <Text tone="success">-€{appliedCoupon.discount_amount.toFixed(2)}</Text>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text variant="headingMd" fontWeight="semibold">Total</Text>
                  <Text variant="headingMd" fontWeight="semibold">
                    €{finalTotal.toFixed(2)}
                  </Text>
                </InlineStack>
              </>
            )}
            
            {!appliedCoupon && (
              <InlineStack align="space-between">
                <Text variant="headingMd" fontWeight="semibold">Total</Text>
                <Text variant="headingMd" fontWeight="semibold">€{finalTotal.toFixed(2)}</Text>
              </InlineStack>
            )}
            
            <Divider />
            <p><strong>Items:</strong></p>
            {order.items?.map((item, index) => (
              <div key={index} style={{ marginLeft: '20px' }}>
                • {item.product_name} x {item.quantity} = €{item.total_price}
              </div>
            ))}
          </BlockStack>
        </Card>

        {/* Componente de Cupón - Solo mostrar si no hay pago exitoso y la orden está pendiente */}
        {order.status === 'pending' && !paymentSuccess && (
          <CouponInput 
            cartTotal={order.total_amount}
            onCouponApplied={handleCouponApplied}
            appliedCoupon={appliedCoupon}
            onRemoveCoupon={handleRemoveCoupon}
          />
        )}

        <Card sectioned title="Payment">
          <Elements stripe={stripePromise}>
            <PaymentForm 
              order={order} 
              finalTotal={finalTotal}
              onPaymentSuccess={handlePaymentSuccess} 
            />
          </Elements>
        </Card>
      </BlockStack>
    </Page>
  );
};

export default Checkout;