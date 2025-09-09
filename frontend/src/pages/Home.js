import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Icon,
} from '@shopify/polaris';
import {
  DeliveryIcon,
  CreditCardIcon,
  ShieldCheckMarkIcon,
} from '@shopify/polaris-icons';
import { useAuth } from '../context/AuthContext';

function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated()) {
      navigate('/products');
    } else {
      navigate('/register');
    }
  };

  const handleViewProducts = () => {
    navigate('/products');
  };

  return (
    <Page fullWidth>
      <Layout>
        {/* Hero Section */}
        <Layout.Section>
          <Card>
            <Box padding="300">
              <BlockStack gap="300" align="center">
                <Text variant="headingXl" as="h1" alignment="center">
                  Welcome to BlitzShop
                </Text>

                <Text variant="bodyMd" as="p" alignment="center">
                  {isAuthenticated()
                    ? `Welcome back, ${user?.username}! Discover amazing products and enjoy seamless shopping.`
                    : 'Lightning-speed commerce platform. Join thousands of satisfied customers today.'}
                </Text>

                <InlineStack gap="200" align="center">
                  <Button primary size="large" onClick={handleGetStarted}>
                    {isAuthenticated() ? 'Shop Now' : 'Get Started'}
                  </Button>
                  <Button size="large" onClick={handleViewProducts}>
                    View Products
                  </Button>
                </InlineStack>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Features Section */}
        <Layout.Section>
          <Layout>
            <Layout.Section oneThird>
              <Card>
                <Box padding="100">
                  <BlockStack gap="100" align="center">
                    <Text variant="headingMd" as="h3" alignment="center">
                      <Icon source={DeliveryIcon} tone="base" inline /> Fast Delivery
                    </Text>
                    <Text variant="bodySm" as="p" alignment="center">
                      Get your orders delivered quickly with our efficient shipping network.
                    </Text>
                  </BlockStack>
                </Box>
              </Card>
            </Layout.Section>

            <Layout.Section oneThird>
              <Card>
                <Box padding="100">
                  <BlockStack gap="100" align="center">
                    <Text variant="headingMd" as="h3" alignment="center">
                      <Icon source={CreditCardIcon} tone="base" inline /> Secure Payments
                    </Text>
                    <Text variant="bodySm" as="p" alignment="center">
                      Shop with confidence using our secure payment processing system.
                    </Text>
                  </BlockStack>
                </Box>
              </Card>
            </Layout.Section>

            <Layout.Section oneThird>
              <Card>
                <Box padding="100">
                  <BlockStack gap="100" align="center">
                    <Text variant="headingMd" as="h3" alignment="center">
                      <Icon source={ShieldCheckMarkIcon} tone="base" inline /> Quality Guarantee
                    </Text>
                    <Text variant="bodySm" as="p" alignment="center">
                      All products come with our quality guarantee and easy returns.
                    </Text>
                  </BlockStack>
                </Box>
              </Card>
            </Layout.Section>
          </Layout>
        </Layout.Section>

        {/* Technical Stack Section */}
        <Layout.Section>
          <Card>
            <Box padding="300">
              <BlockStack gap="300">
                <Text variant="headingLg" as="h2" alignment="center">
                  Built with Modern Technologies
                </Text>

                <Layout>
                  <Layout.Section oneThird>
                    <BlockStack align="center" gap="150">
                      <Text variant="headingMd" as="p">Frontend</Text>
                      <Text variant="bodySm" tone="subdued" alignment="center">
                        React 18 with Shopify Polaris UI
                      </Text>
                      <Text variant="bodySm" tone="subdued" alignment="center">
                        Deployed on Netlify
                      </Text>
                    </BlockStack>
                  </Layout.Section>

                  <Layout.Section oneThird>
                    <BlockStack align="center" gap="150">
                      <Text variant="headingMd" as="p">Backend</Text>
                      <Text variant="bodySm" tone="subdued" alignment="center">
                        Flask with SQLAlchemy ORM
                      </Text>
                      <Text variant="bodySm" tone="subdued" alignment="center">
                        Deployed on Render
                      </Text>
                    </BlockStack>
                  </Layout.Section>

                  <Layout.Section oneThird>
                    <BlockStack align="center" gap="150">
                      <Text variant="headingMd" as="p">Database</Text>
                      <Text variant="bodySm" tone="subdued" alignment="center">
                        PostgreSQL on Supabase
                      </Text>
                      <Text variant="bodySm" tone="subdued" alignment="center">
                        With Flask-Migrate
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                </Layout>

                <Text variant="bodySm" tone="subdued" alignment="center">
                  Full-stack e-commerce solution with professional architecture and best practices
                </Text>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Call to Action */}
        {!isAuthenticated() && (
          <Layout.Section>
            <Card>
              <Box padding="300">
                <BlockStack gap="300" align="center">
                  <Text variant="headingLg" as="h2">Ready to start shopping?</Text>

                  <Text variant="bodySm" as="p" alignment="center">
                    Create your free account and get access to exclusive deals and faster checkout.
                  </Text>

                  <InlineStack gap="200" align="center">
                    <Button primary size="large" onClick={() => navigate('/register')}>
                      Create account
                    </Button>
                    <Button size="large" onClick={() => navigate('/login')}>
                      Sign in
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        )}

        {/* Admin Section */}
        {isAuthenticated() && user?.is_admin && (
          <Layout.Section>
            <Card>
              <Box padding="300">
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Admin dashboard</Text>

                  <Text variant="bodySm" as="p">
                    Manage your store, products, and orders from the admin panel.
                  </Text>

                  <Button onClick={() => navigate('/admin')}>Open admin dashboard</Button>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

export default Home;
