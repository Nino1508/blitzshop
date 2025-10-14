import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Spinner,
  Banner
} from '@shopify/polaris';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/products/${id}`);
      const data = await response.json();

      if (response.ok) {
        setProduct(data.product);
      } else {
        setError(data.error || 'Product not found');
      }
    } catch (error) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    setAddingToCart(true);
    const result = await addToCart(product.id, 1);
    
    if (result.success) {
      // Could show success message
      console.log('Product added to cart');
    } else {
      console.error('Failed to add to cart:', result.error);
    }
    setAddingToCart(false);
  };

  const handleGoBack = () => {
    navigate('/products');
  };

  if (loading) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <InlineStack gap="400" blockAlign="center">
                <Spinner size="large" />
                <Text variant="bodyMd">Loading product...</Text>
              </InlineStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (error || !product) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Banner status="critical">
              <p>{error || 'Product not found'}</p>
            </Banner>
            <div style={{ marginTop: '16px' }}>
              <Button onClick={handleGoBack}>
                ← Back to Products
              </Button>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      breadcrumbs={[
        { content: 'Products', onAction: handleGoBack }
      ]}
      title={product.name}
    >
      <Layout>
        <Layout.Section oneHalf>
          {/* Product Image */}
          <Card>
            <div style={{ 
              height: '400px', 
              backgroundColor: '#f6f6f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <Text variant="bodyLg" color="subdued">
                  No image available
                </Text>
              )}
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section oneHalf>
          {/* Product Details */}
          <Card sectioned>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text variant="displayMedium" as="h1">
                  {product.name}
                </Text>
                
                {product.category && (
                  <Badge variant="headingMd">{product.category}</Badge>
                )}
              </BlockStack>

              <Text variant="displaySmall" as="p">
                ${product.price}
              </Text>

              {product.description && (
                <div>
                  <Text variant="headingMd" as="h3">
                    Description
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {product.description}
                  </Text>
                </div>
              )}

              <div>
                <Text variant="bodyMd" as="p">
                  <strong>Stock:</strong> {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
                </Text>
                <Text variant="bodyMd" as="p">
                  <strong>Status:</strong> {product.is_active ? 'Available' : 'Unavailable'}
                </Text>
              </div>

              <InlineStack gap="400">
                <Button
                  primary
                  size="large"
                  onClick={handleAddToCart}
                  disabled={!product.is_active || product.stock === 0 || addingToCart}
                  loading={addingToCart}
                >
                  {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </Button>
                
                <Button
                  size="large"
                  onClick={handleGoBack}
                >
                  ← Back to Products
                </Button>
              </InlineStack>

              {!isAuthenticated() && (
                <Banner status="info">
                  <p>
                    <Button 
                      plain 
                      onClick={() => navigate('/login')}
                      style={{ textDecoration: 'underline' }}
                    >
                      Sign in
                    </Button> to add items to your cart.
                  </p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default ProductDetail;