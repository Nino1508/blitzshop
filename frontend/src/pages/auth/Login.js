import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
  Banner,
  Icon
} from '@shopify/polaris';
import { ViewIcon, HideIcon } from '@shopify/polaris-icons';
import { useAuth } from '../../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated() && !loading) {
      navigate('/');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleInputChange = (field) => (value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    // Clear login error
    if (loginError) {
      setLoginError('');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setLoginError('');

    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        navigate('/');
      } else {
        setLoginError(result.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = () => {
    // Por ahora solo mostrar mensaje, luego implementaremos la funcionalidad completa
    alert('Password reset feature coming soon! For now, please contact support.');
  };

  if (loading) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <div style={{ textAlign: 'center' }}>
                <Text variant="bodyMd">Loading...</Text>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <Card sectioned>
              <BlockStack gap="500">
                <div style={{ textAlign: 'center' }}>
                  <Text variant="headingMd">Sign In</Text>
                  <Text variant="bodyMd" as="p">
                    Welcome back! Please sign in to your account.
                  </Text>
                </div>

                {loginError && (
                  <Banner status="critical">
                    <p>{loginError}</p>
                  </Banner>
                )}

                <form onSubmit={handleSubmit}>
                  <FormLayout>
                    <TextField
                      label="Email"
                      value={formData.email}
                      onChange={handleInputChange('email')}
                      error={errors.email}
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                    />

                    <TextField
                      label="Password"
                      value={formData.password}
                      onChange={handleInputChange('password')}
                      error={errors.password}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      suffix={
                        <div 
                          onClick={togglePasswordVisibility}
                          style={{ 
                            cursor: 'pointer', 
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Icon source={showPassword ? HideIcon : ViewIcon} color="subdued" />
                        </div>
                      }
                    />

                    <Button
                      primary
                      submit
                      fullWidth
                      loading={isSubmitting}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </FormLayout>
                </form>

                <div style={{ textAlign: 'center' }}>
                  <Text variant="bodyMd" as="p">
                    Don't have an account?{' '}
                    <Link 
                      to="/register" 
                      style={{ 
                        color: '#008060', 
                        textDecoration: 'none',
                        fontWeight: '500'
                      }}
                    >
                      Create one here
                    </Link>
                  </Text>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <Text variant="bodyMd" as="p">
                    Forgot your password?{' '}
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#008060',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'none',
                        fontWeight: '500',
                        fontSize: 'inherit',
                        fontFamily: 'inherit'
                      }}
                    >
                      Reset it here
                    </button>
                  </Text>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <Link 
                    to="/" 
                    style={{ 
                      color: '#637381', 
                      textDecoration: 'none',
                      fontSize: '14px'
                    }}
                  >
                    ← Back to Home
                  </Link>
                </div>
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default Login;