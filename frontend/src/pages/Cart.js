import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  LegacyStack,
  EmptyState,
  DataTable,
  Banner
} from '@shopify/polaris';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Cart() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { 
    cartItems, 
    loading, 
    updateCartItem, 
    removeFromCart, 
    clearCart,
    getTotalItems,
    getTotalPrice,
    fetchCartItems
  } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchCartItems();
    }
  }, [isAuthenticated]);

  const handleQuantityChange = async (cartItemId, newQuantity) => {
    if (newQuantity <= 0) {
      await removeFromCart(cartItemId);
    } else {
      await updateCartItem(cartItemId, newQuantity);
    }
  };

  const handleRemoveItem = async (cartItemId) => {
    await removeFromCart(cartItemId);
  };

  const handleClearCart = async () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      await clearCart();
    }
  };

  const handleContinueShopping = () => {
    navigate('/products');
  };

  const handleCheckout = async () => {
    console.log('CartItems at checkout:', cartItems);
    console.log('CartItems length:', cartItems.length);
    console.log('First item:', cartItems[0]);
    console.log('Product details:', cartItems[0].product);
    try {
    // Verificar que hay items en el carrito
    if (!cartItems || cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }

    // 1. Crear orden desde el carrito
    const response = await fetch(`${API_URL}/api/orders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ecommerce-jwt-token')}`
      },
      body: JSON.stringify({
        items: cartItems.map(item => ({
          product_id: item.product_id , 
          quantity: item.quantity,
          unit_price: item.total_price / item.quantity 
        })),
        shipping_address: 'Default address', // Por ahora básico
        billing_address: 'Default address',
        total_amount: getTotalPrice() // Usas getTotalPrice() no total
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create order');
    }

    const orderData = await response.json();
    
    // 2. Limpiar el carrito después de crear la orden exitosamente
    await clearCart();
    
    // 3. Navegar a checkout con el ID de la orden
    navigate(`/checkout?order_id=${orderData.order.id}`);
    
  } catch (error) {
    console.error('Checkout error:', error);
    alert(`Error creating order: ${error.message}`);
  }
};

  // Professional quantity controls component
  const QuantityControls = ({ item }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '2px'
    }}>
      <button
        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
        style={{
          width: '28px',
          height: '28px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          backgroundColor: '#f9fafb',
          color: '#374151',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
      >
        −
      </button>
      
      <span style={{
        minWidth: '40px',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: '500',
        color: '#111827',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {item.quantity}
      </span>
      
      <button
        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
        style={{
          width: '28px',
          height: '28px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          backgroundColor: '#f9fafb',
          color: '#374151',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
      >
        +
      </button>
    </div>
  );

  // Professional price formatting
  const formatPrice = (price) => `$${Number(price).toFixed(2)}`;

  if (!isAuthenticated()) {
    return (
      <Page title="Shopping Cart">
        <Layout>
          <Layout.Section>
            <Banner status="info">
              <p>Please sign in to view your cart.</p>
            </Banner>
            <div style={{ marginTop: '16px' }}>
              <LegacyStack>
                <Button primary onClick={() => navigate('/login')}>
                  Sign In
                </Button>
                <Button onClick={() => navigate('/register')}>
                  Create Account
                </Button>
              </LegacyStack>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page title="Shopping Cart">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <Text variant="bodyMd">Loading cart...</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (cartItems.length === 0) {
    return (
      <Page title="Shopping Cart">
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="Your cart is empty"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Add some products to get started!</p>
              <div style={{ marginTop: '16px' }}>
                <Button primary onClick={handleContinueShopping}>
                  Continue Shopping
                </Button>
              </div>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (isMobile) {
    // MOBILE LAYOUT - CARDS
    return (
      <Page 
        title="Shopping Cart"
        subtitle={`${getTotalItems()} ${getTotalItems() === 1 ? 'item' : 'items'}`}
      >
        <Layout>
          {/* Mobile Cart Items */}
          <Layout.Section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cartItems.map((item) => (
                <Card key={item.id}>
                  <div style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {/* Product Image - LARGER */}
                      <div style={{
                        width: '100px',
                        height: '100px',
                        backgroundColor: '#f6f6f7',
                        borderRadius: '8px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {item.product?.image_url ? (
                          <img 
                            src={item.product.image_url} 
                            alt={item.product.name}
                            style={{ 
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: '8px'
                            }}
                          />
                        ) : (
                          <Text variant="bodySm" color="subdued">No image</Text>
                        )}
                      </div>
                      
                      {/* Product Info - COMPACT */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#111827',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          marginBottom: '4px',
                          lineHeight: '1.3'
                        }}>
                          {item.product?.name || 'Unknown Product'}
                        </div>
                        
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '400',
                          color: '#6b7280',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          marginBottom: '8px'
                        }}>
                          {formatPrice(item.unit_price)} each
                        </div>
                        
                        {/* Quantity and Price - TIGHT LAYOUT */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <QuantityControls item={item} />
                          
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#111827',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            textAlign: 'center',
                            flex: 1,
                            marginLeft: '12px'
                          }}>
                            {formatPrice(item.total_price)}
                          </div>
                        </div>
                        
                        {/* Remove Button - COMPACT */}
                        <div style={{ marginTop: '6px' }}>
                          <Button
                            destructive
                            plain
                            size="slim"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Layout.Section>

          {/* Mobile Cart Summary */}
          <Layout.Section>
            <Card sectioned>
              <div style={{ textAlign: 'center' }}>
                <Text variant="headingMd" as="h3">
                  Order Summary
                </Text>
                <Text variant="bodyMd" color="subdued">
                  {getTotalItems()} items
                </Text>
                <Text variant="headingLg" as="p" style={{ marginTop: '8px' }}>
                  {formatPrice(getTotalPrice())}
                </Text>
                
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  marginTop: '16px' 
                }}>
                  <Button primary fullWidth onClick={handleCheckout}>
                    Proceed to Checkout
                  </Button>
                  <Button fullWidth onClick={handleContinueShopping}>
                    Continue Shopping
                  </Button>
                  <Button destructive plain onClick={handleClearCart}>
                    Clear Cart
                  </Button>
                </div>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // DESKTOP LAYOUT - TABLE
  const rows = cartItems.map((item) => [
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        backgroundColor: '#f6f6f7',
        borderRadius: '6px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {item.product?.image_url ? (
          <img 
            src={item.product.image_url} 
            alt={item.product.name}
            style={{ 
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '6px'
            }}
          />
        ) : (
          <span style={{ fontSize: '10px', color: '#6b7280' }}>No image</span>
        )}
      </div>
      <span style={{
        fontSize: '14px',
        fontWeight: '500',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {item.product?.name || 'Unknown Product'}
      </span>
    </div>,
    <span style={{
      fontSize: '14px',
      fontWeight: '400',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {formatPrice(item.unit_price)}
    </span>,
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
      padding: '8px 0'
    }}>
      <QuantityControls key={item.id} item={item} />
    </div>,
    <span style={{ 
      fontWeight: '500',
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {formatPrice(item.total_price)}
    </span>,
    <Button 
      key={item.id}
      destructive 
      size="slim"
      onClick={() => handleRemoveItem(item.id)}
    >
      Remove
    </Button>
  ]);

  return (
    <Page 
      title="Shopping Cart"
      subtitle={`${getTotalItems()} ${getTotalItems() === 1 ? 'item' : 'items'}`}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text', 'text']}
              headings={['Product', 'Price', 'Quantity', 'Total', 'Action']}
              rows={rows}
              verticalAlign="middle"
            />
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card sectioned>
            <LegacyStack distribution="equalSpacing" alignment="center">
              <LegacyStack vertical spacing="tight">
                <Text variant="headingMd" as="h3">
                  Cart Summary
                </Text>
                <Text variant="bodyMd">
                  Total Items: {getTotalItems()}
                </Text>
                <Text variant="displaySmall" as="p">
                  Total: {formatPrice(getTotalPrice())}
                </Text>
              </LegacyStack>

              <LegacyStack vertical spacing="tight">
                <Button primary size="large" onClick={handleCheckout}>
                  Proceed to Checkout
                </Button>
                <Button onClick={handleContinueShopping}>
                  Continue Shopping
                </Button>
                <Button destructive plain onClick={handleClearCart}>
                  Clear Cart
                </Button>
              </LegacyStack>
            </LegacyStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default Cart;