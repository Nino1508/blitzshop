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

function Register() {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    
    // Clear register error
    if (registerError) {
      setRegisterError('');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.first_name) {
      newErrors.first_name = 'First name is required';
    } else if (formData.first_name.length < 2) {
      newErrors.first_name = 'First name must be at least 2 characters';
    }

    if (!formData.last_name) {
      newErrors.last_name = 'Last name is required';
    } else if (formData.last_name.length < 2) {
      newErrors.last_name = 'Last name must be at least 2 characters';
    }

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

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
    setRegisterError('');

    try {
      const userData = {
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name
      };

      const result = await register(userData);
      
      if (result.success) {
        navigate('/');
      } else {
        setRegisterError(result.error || 'Registration failed');
      }
    } catch (error) {
      setRegisterError('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
                  <Text variant="headingMd">Create Account</Text>
                  <Text variant="bodyMd" as="p">
                    Join us today and start shopping!
                  </Text>
                </div>

                {registerError && (
                  <Banner status="critical">
                    <p>{registerError}</p>
                  </Banner>
                )}

                <form onSubmit={handleSubmit}>
                  <FormLayout>
                    <FormLayout.Group>
                      <TextField
                        label="First Name"
                        value={formData.first_name}
                        onChange={handleInputChange('first_name')}
                        error={errors.first_name}
                        autoComplete="given-name"
                        placeholder="Enter your first name"
                      />

                      <TextField
                        label="Last Name"
                        value={formData.last_name}
                        onChange={handleInputChange('last_name')}
                        error={errors.last_name}
                        autoComplete="family-name"
                        placeholder="Enter your last name"
                      />
                    </FormLayout.Group>

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
                      autoComplete="new-password"
                      placeholder="Create a password"
                      helpText="Must be at least 6 characters"
                      suffix={
                        <div 
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ 
                            cursor: 'pointer', 
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            background: 'transparent'
                          }}
                        >
                          <Icon source={showPassword ? HideIcon : ViewIcon} color="subdued" />
                        </div>
                      }
                    />

                    <TextField
                      label="Confirm Password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange('confirmPassword')}
                      error={errors.confirmPassword}
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Confirm your password"
                      suffix={
                        <div 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{ 
                            cursor: 'pointer', 
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            background: 'transparent'
                          }}
                        >
                          <Icon source={showConfirmPassword ? HideIcon : ViewIcon} color="subdued" />
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
                      {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </FormLayout>
                </form>

                <div style={{ textAlign: 'center' }}>
                  <Text variant="bodyMd" as="p">
                    Already have an account?{' '}
                    <Link 
                      to="/login" 
                      style={{ 
                        color: '#008060', 
                        textDecoration: 'none',
                        fontWeight: '500'
                      }}
                    >
                      Sign in here
                    </Link>
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

export default Register;