import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  LegacyStack,
  TextField,
  Select,
  Spinner,
  EmptyState,
  Badge
} from '@shopify/polaris';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

// Detectar entorno automáticamente
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://blitzshop-backend.onrender.com';

function ProductList() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await fetch(`${API_URL}/api/products?${params}`);
      const data = await response.json();

      if (response.ok) {
        setProducts(data.products || []);
      } else {
        setError(data.error || 'Failed to fetch products');
      }
    } catch (error) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/products/categories`);
      const data = await response.json();

      if (response.ok) {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleAddToCart = async (productId) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    const result = await addToCart(productId, 1);
    if (result.success) {
      console.log('Product added to cart');
    } else {
      console.error('Failed to add to cart:', result.error);
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  const categoryOptions = [
    { label: 'All Categories', value: '' },
    ...categories.map(cat => ({ label: cat, value: cat }))
  ];

  if (loading && products.length === 0) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <LegacyStack alignment="center">
                <Spinner variant="headingLg" />
                <Text variant="bodyMd">Loading products...</Text>
              </LegacyStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Products"
      subtitle={
        <Text variant="headingMd" as="h2" alignment="center">
          Discover our amazing collection
        </Text>
      }
    >
      <Layout>
        {/* Filters */}
        <Layout.Section>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>
              <Card sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '100%' }}>
                    <TextField
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={setSearchTerm}
                      clearButton
                      onClearButtonClick={() => setSearchTerm('')}
                    />
                  </div>
                  <div style={{ width: '100%' }}>
                    <Select
                      label=""
                      options={categoryOptions}
                      value={selectedCategory}
                      onChange={setSelectedCategory}
                    />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Layout.Section>

        {/* Error State */}
        {error && (
          <Layout.Section>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Card sectioned style={{ maxWidth: '600px', width: '100%' }}>
                <Text variant="bodyMd" color="critical" alignment="center">
                  {error}
                </Text>
              </Card>
            </div>
          </Layout.Section>
        )}

        {/* Products Grid */}
        <Layout.Section>
          {products.length === 0 && !loading ? (
            <EmptyState
              heading="No products found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Try adjusting your search or filter criteria.</p>
            </EmptyState>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
              gap: '20px' 
            }}>
              {products.map((product) => (
                <Card key={product.id}>
                  <div style={{ padding: '16px' }}>
                    <LegacyStack vertical spacing="tight">
                      {/* Product Image */}
                      <div 
                        style={{ 
                          height: '200px', 
                          backgroundColor: '#f6f6f7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        onClick={() => handleProductClick(product.id)}
                      >
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
                          <Text variant="bodyMd" color="subdued">
                            No image
                          </Text>
                        )}
                        {/* Badge de descuento */}
                        {product.discount_percentage && product.discount_percentage > 0 && (
                          <div style={{ 
                            position: 'absolute', 
                            top: '8px', 
                            right: '8px' 
                          }}>
                            <Badge tone="critical">-{product.discount_percentage}%</Badge>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <LegacyStack vertical spacing="extraTight">
                        <Text 
                          variant="headingMd" 
                          as="h3"
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleProductClick(product.id)}
                        >
                          {product.name}
                        </Text>
                        
                        {product.category && (
                          <Badge size="small">{product.category}</Badge>
                        )}
                        
                        <Text variant="bodyMd" color="subdued">
                          {product.description?.substring(0, 100)}
                          {product.description?.length > 100 && '...'}
                        </Text>
                      </LegacyStack>

                      {/* Price and Actions */}
                      <LegacyStack distribution="equalSpacing" alignment="center">
                        <div>
                          {product.discount_percentage && product.discount_percentage > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <Text variant="bodyMd" tone="subdued" textDecorationLine="line-through">
                                €{product.price}
                              </Text>
                              <Text variant="headingLg" tone="success">
                                €{(product.price * (1 - product.discount_percentage/100)).toFixed(2)}
                              </Text>
                            </div>
                          ) : (
                            <Text variant="headingLg" as="p">
                              €{product.price}
                            </Text>
                          )}
                        </div>
                        
                        <LegacyStack spacing="tight">
                          <Button
                            onClick={() => handleProductClick(product.id)}
                          >
                            View Details
                          </Button>
                          
                          <Button
                            primary
                            onClick={() => handleAddToCart(product.id)}
                            disabled={!product.is_active || product.stock === 0}
                          >
                            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                          </Button>
                        </LegacyStack>
                      </LegacyStack>

                      {/* Stock Info */}
                      <Text variant="bodySm" color="subdued">
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </Text>
                    </LegacyStack>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default ProductList;