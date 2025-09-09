import React, { useState, useEffect } from 'react';
import {
  Page,
  Card,
  DataTable,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Text,
  EmptyState,
  Spinner,
  Banner
} from '@shopify/polaris';
import { DownloadIcon } from '@shopify/polaris-icons';

const UserInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchInvoices();
  }, [currentPage]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ecommerce-jwt-token');
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/invoices?page=${currentPage}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      
      const data = await response.json();
      setInvoices(data.invoices || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/invoices/${invoiceId}/download`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download invoice');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { tone: 'warning', label: 'Pending' },
      'paid': { tone: 'success', label: 'Paid' },
      'cancelled': { tone: 'critical', label: 'Cancelled' },
      'refunded': { tone: 'info', label: 'Refunded' }
    };
    
    const config = statusMap[status] || { tone: 'default', label: status };
    return <Badge tone={config.tone}>{config.label}</Badge>;
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <Page title="My Invoices">
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="My Invoices">
        <Banner tone="critical" onDismiss={() => setError(null)}>
          <p>{error}</p>
        </Banner>
      </Page>
    );
  }

  const rows = invoices.map(invoice => [
    invoice.invoice_number,
    new Date(invoice.issue_date).toLocaleDateString(),
    invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A',
    formatCurrency(invoice.total_amount, invoice.currency),
    getStatusBadge(invoice.status),
    <Button
      size="slim"
      icon={DownloadIcon}
      onClick={() => handleDownloadInvoice(invoice.id, invoice.invoice_number)}
    >
      Download
    </Button>
  ]);

  return (
    <Page title="My Invoices">
      <Card>
        {invoices.length === 0 ? (
          <EmptyState
            heading="No invoices yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Your invoices will appear here once you make a purchase.</p>
          </EmptyState>
        ) : (
          <BlockStack gap="4">
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
              headings={[
                'Invoice #',
                'Issue Date',
                'Due Date',
                'Total',
                'Status',
                'Action'
              ]}
              rows={rows}
            />
            
            {totalPages > 1 && (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <InlineStack gap="2" align="center">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Text as="span">
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </InlineStack>
              </div>
            )}
          </BlockStack>
        )}
      </Card>
    </Page>
  );
};

export default UserInvoices; 
