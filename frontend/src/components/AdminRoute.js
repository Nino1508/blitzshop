// frontend/src/components/AdminRoute.js

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Page, Layout, Text, TextContainer, Button } from '@shopify/polaris';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Mostrar loading mientras se verifica autenticación
  if (loading) {
    return (
      <Page title="Loading...">
        <Layout>
          <Layout.Section>
            <Card>
              <Card.Section>
                <div style={{ textAlign: 'center' }}>
                  <div>Loading...</div>
                </div>
              </Card.Section>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Redirigir a login si no está autenticado
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Mostrar mensaje de acceso denegado si no es admin
  if (!user.is_admin) {
    return (
      <Page title="Access Denied">
        <Layout>
          <Layout.Section>
            <Card>
              <Card.Section>
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Text variant="headingLg" as="h2">🚫 Access Denied</Text>
                  <div style={{ marginTop: '16px' }}>
                    <TextContainer>
                      <p>
                        You don't have administrator privileges to access this area.
                        Contact your system administrator if you believe this is an error.
                      </p>
                    </TextContainer>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <Button 
                      url="/products" 
                      primary
                    >
                      Go to Products
                    </Button>
                  </div>
                </div>
              </Card.Section>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Renderizar componente si es admin
  return children;
};

export default AdminRoute;