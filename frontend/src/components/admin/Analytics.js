import React, { useState, useEffect } from 'react';
import {
  Card,
  Layout,
  Text,
  Badge,
  Button,
  DataTable,
  Spinner,
  Select,
  InlineStack,
  BlockStack,
  Grid,
  Banner,
  Icon,
  EmptyState,
  Box,
  Divider
} from '@shopify/polaris';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  AlertCircleIcon,
  ExportIcon,
  ChartVerticalIcon
} from '@shopify/polaris-icons';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Datos
  const [metrics, setMetrics] = useState({});
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({});

  // UI state
  const [selectedPeriod, setSelectedPeriod] = useState('7');
  const [viewMode, setViewMode] = useState('daily');
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // ===== Helpers de AUTH y Fetch con manejo de errores =====
  const getAuthHeaders = () => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('ecommerce-jwt-token');
    return token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };
  };

  const apiGet = async (url) => {
    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      const contentType = res.headers.get('content-type') || '';
      let data = null;
      
      try {
        data = contentType.includes('application/json')
          ? await res.json()
          : await res.text();
      } catch {
        data = null;
      }
      
      if (!res.ok) {
        const msg =
          (data && (data.message || data.error || data.msg)) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }
      
      // Debug para ver qué devuelven los endpoints
      console.log(`Response from ${url}:`, data);
      
      return data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  };

  // ===== Responsive resize =====
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ===== Carga de datos =====
  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    try {
      // Llamadas paralelas con manejo de error por endpoint
      const [
        metricsP,
        dailyP,
        monthlyP,
        topProductsP,
        lowStockP,
        topCustomersP,
        categoriesP,
        summaryP,
      ] = await Promise.allSettled([
        apiGet(`${API_URL}/api/analytics/dashboard`),
        apiGet(`${API_URL}/api/analytics/revenue/daily?days=${selectedPeriod}`),
        apiGet(`${API_URL}/api/analytics/revenue/monthly`),
        apiGet(`${API_URL}/api/analytics/products/top?limit=10`),
        apiGet(`${API_URL}/api/analytics/products/low-stock`),
        apiGet(`${API_URL}/api/analytics/customers/top`),
        apiGet(`${API_URL}/api/analytics/categories/performance`),
        apiGet(`${API_URL}/api/analytics/summary?days=${selectedPeriod}`),
      ]);

      const getVal = (p, def) =>
        p.status === 'fulfilled'
          ? p.value ?? def
          : def;

      // Normalización: objetos o arrays según corresponda
      const metricsData = getVal(metricsP, {});
      const dailyData = getVal(dailyP, []);
      const monthlyData = getVal(monthlyP, []);
      const topProductsData = getVal(topProductsP, []);
      const lowStockData = getVal(lowStockP, []);
      const topCustomersData = getVal(topCustomersP, []);
      const categoriesData = getVal(categoriesP, []);
      const summaryData = getVal(summaryP, {});

      // Asegurar que sean arrays
      setMetrics(metricsData);
      setDailyRevenue(Array.isArray(dailyData) ? dailyData : []);
      setMonthlyRevenue(Array.isArray(monthlyData) ? monthlyData : []);
      
      // Para top products y customers, verificar si vienen dentro de un objeto
      if (topProductsData && topProductsData.products) {
        setTopProducts(Array.isArray(topProductsData.products) ? topProductsData.products : []);
      } else {
        setTopProducts(Array.isArray(topProductsData) ? topProductsData : []);
      }
      
      if (topCustomersData && topCustomersData.customers) {
        setTopCustomers(Array.isArray(topCustomersData.customers) ? topCustomersData.customers : []);
      } else {
        setTopCustomers(Array.isArray(topCustomersData) ? topCustomersData : []);
      }
      
      setLowStockProducts(Array.isArray(lowStockData) ? lowStockData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setSummary(summaryData);

      // Si hubo algún rejected, mostramos un mensaje sutil
      const anyRejected = [
        metricsP, dailyP, monthlyP, topProductsP, lowStockP, topCustomersP, categoriesP, summaryP,
      ].some(p => p.status === 'rejected');
      if (anyRejected) {
        console.log('Some analytics sections could not be loaded');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Error loading some analytics data');
      // Estados seguros
      setMetrics({});
      setDailyRevenue([]);
      setMonthlyRevenue([]);
      setTopProducts([]);
      setLowStockProducts([]);
      setTopCustomers([]);
      setCategories([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  // CORREGIDO: Export con fechas correctas
  const exportData = async (type) => {
    try {
      // Calcular fecha de inicio basada en el período seleccionado
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(selectedPeriod));
      
      // Formatear fechas como YYYY-MM-DD
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const params = new URLSearchParams({
        type: type,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate)
      });
      
      const res = await fetch(
        `${API_URL}/api/analytics/export?${params}`,
        { headers: getAuthHeaders() }
      );
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.message || data?.error || `Export failed`;
        throw new Error(msg);
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${type}_${formatDate(endDate)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      setError(`Export failed: ${error.message}`);
    }
  };

  const formatPrice = (price) => `€${Number(price || 0).toFixed(2)}`;

  const periodOptions = [
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
  ];

  const viewOptions = [
    { label: 'Daily', value: 'daily' },
    { label: 'Monthly', value: 'monthly' },
  ];

  if (loading) {
    return (
      <Card sectioned>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spinner size="large" />
          <div style={{ marginTop: '20px' }}>
            <Text variant="bodyMd">Loading analytics data...</Text>
          </div>
        </div>
      </Card>
    );
  }

  const currentSeries = viewMode === 'daily' ? dailyRevenue : monthlyRevenue;
  const maxRevenue = Math.max(...(Array.isArray(currentSeries) && currentSeries.length ? currentSeries.map(d => d.revenue || 0) : [0]));

  // ===== MOBILE LAYOUT =====
  if (isMobile) {
    return (
      <Layout>
        {/* Mobile Controls */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="300">
                <Select
                  label="Period"
                  options={periodOptions}
                  value={selectedPeriod}
                  onChange={setSelectedPeriod}
                />
                <Select
                  label="View"
                  options={viewOptions}
                  value={viewMode}
                  onChange={setViewMode}
                />
                <Button
                  fullWidth
                  icon={ExportIcon}
                  onClick={() => exportData('orders')}
                >
                  Export Data
                </Button>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Mobile Metrics */}
        <Layout.Section>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Key Metrics</Text>

            {/* Revenue Cards */}
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text variant="bodyMd" tone="subdued">Total Revenue</Text>
                  <Text variant="headingXl" as="p">{formatPrice(metrics.total_revenue)}</Text>
                  <Text variant="bodySm" tone="subdued">All time</Text>
                </BlockStack>
              </Box>
            </Card>

            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text variant="bodyMd" tone="subdued">Today's Revenue</Text>
                  <Text variant="headingXl" as="p">{formatPrice(metrics.today_revenue)}</Text>
                  {typeof metrics.growth_percentage === 'number' && metrics.growth_percentage !== 0 ? (
                    <InlineStack gap="200" align="start">
                      {metrics.growth_percentage > 0 ? (
                        <>
                          <Icon source={ArrowUpIcon} tone="success" />
                          <Text variant="bodySm" tone="success">+{metrics.growth_percentage}%</Text>
                        </>
                      ) : (
                        <>
                          <Icon source={ArrowDownIcon} tone="critical" />
                          <Text variant="bodySm" tone="critical">{metrics.growth_percentage}%</Text>
                        </>
                      )}
                    </InlineStack>
                  ) : null}
                </BlockStack>
              </Box>
            </Card>

            {/* Grid metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Card>
                <Box padding="300">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued" alignment="center">Orders</Text>
                    <Text variant="headingLg" alignment="center">{metrics.total_orders || 0}</Text>
                  </BlockStack>
                </Box>
              </Card>

              <Card>
                <Box padding="300">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued" alignment="center">Customers</Text>
                    <Text variant="headingLg" alignment="center">{metrics.total_customers || 0}</Text>
                  </BlockStack>
                </Box>
              </Card>

              <Card>
                <Box padding="300">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued" alignment="center">Avg Order</Text>
                    <Text variant="headingMd" alignment="center">{formatPrice(metrics.avg_order_value)}</Text>
                  </BlockStack>
                </Box>
              </Card>

              <Card>
                <Box padding="300">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued" alignment="center">Low Stock</Text>
                    <Text variant="headingLg" alignment="center">{metrics.low_stock_alert || 0}</Text>
                  </BlockStack>
                </Box>
              </Card>
            </div>
          </BlockStack>
        </Layout.Section>

        {/* Mobile Revenue Chart */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  {viewMode === 'daily' ? 'Daily Revenue' : 'Monthly Revenue'}
                </Text>

                <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    height: '150px',
                    gap: '6px',
                    minWidth: viewMode === 'daily' ? `${currentSeries.length * 45}px` : 'auto'
                  }}>
                    {currentSeries.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          minWidth: '40px'
                        }}
                      >
                        <div
                          style={{
                            width: '28px',
                            height: maxRevenue > 0 ? `${((item.revenue || 0) / maxRevenue) * 120}px` : '2px',
                            minHeight: '2px',
                            backgroundColor: '#5c6ac4',
                            borderRadius: '4px 4px 0 0'
                          }}
                        />
                        <div style={{
                          marginTop: '4px',
                          fontSize: '9px',
                          color: '#637381',
                          textAlign: 'center'
                        }}>
                          {viewMode === 'daily'
                            ? (item.date ? new Date(item.date).getDate() + ' ago' : '')
                            : (item.month?.substring(5) || '')
                          }
                        </div>
                        <div style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#202223'
                        }}>
                          {formatPrice(item.revenue)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Mobile Low Stock Products - Como Card normal, no Banner */}
        {lowStockProducts.length > 0 && (
          <Layout.Section>
            <Card>
              <Box padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h3">Low Stock Alert</Text>
                    <Badge tone="warning">{lowStockProducts.length} products</Badge>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    These products need restocking soon
                  </Text>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        )}

        {/* Mobile Top Products */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h3">Top Products</Text>
                  <Button plain size="slim" onClick={() => exportData('products')}>Export</Button>
                </InlineStack>

                {topProducts.length > 0 ? (
                  <BlockStack gap="200">
                    {topProducts.slice(0, 5).map((product, index) => (
                      <Box
                        key={index}
                        paddingBlockStart="200"
                        paddingBlockEnd="200"
                        borderBlockEndWidth="025"
                        borderColor="border-secondary"
                      >
                        <InlineStack align="space-between">
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold">
                              {product.name}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              {product.units_sold} sold
                            </Text>
                          </BlockStack>
                          <Text variant="bodyMd">{formatPrice(product.revenue)}</Text>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    No sales data available yet
                  </Text>
                )}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Mobile Categories */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">Categories</Text>

                {categories.length > 0 ? (
                  <BlockStack gap="200">
                    {categories.slice(0, 4).map((category, index) => (
                      <div key={index}>
                        <InlineStack align="space-between">
                          <Text variant="bodySm">{category.category}</Text>
                          <Badge size="small">{category.percentage}%</Badge>
                        </InlineStack>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          backgroundColor: '#f1f2f4',
                          borderRadius: '3px',
                          marginTop: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${category.percentage}%`,
                            height: '100%',
                            backgroundColor: '#5c6ac4',
                            borderRadius: '3px'
                          }} />
                        </div>
                      </div>
                    ))}
                  </BlockStack>
                ) : (
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    No category data available
                  </Text>
                )}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Mobile Top Customers */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h3">Top Customers</Text>
                  <Button plain size="slim" onClick={() => exportData('customers')}>Export</Button>
                </InlineStack>

                {topCustomers.length > 0 ? (
                  <BlockStack gap="200">
                    {topCustomers.slice(0, 5).map((customer, index) => (
                      <Box
                        key={index}
                        paddingBlockStart="200"
                        paddingBlockEnd="200"
                        borderBlockEndWidth="025"
                        borderColor="border-secondary"
                      >
                        <Text variant="bodyMd" fontWeight="semibold">
                          {customer.username}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {customer.email}
                        </Text>
                        <InlineStack align="space-between">
                          <Text variant="bodySm">{customer.total_orders} orders</Text>
                          <Text variant="bodySm" fontWeight="semibold">
                            {formatPrice(customer.total_spent)}
                          </Text>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    No customer data available yet
                  </Text>
                )}
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    );
  }

  // ===== DESKTOP LAYOUT =====
  return (
    <Layout>
      {/* Desktop Controls */}
      <Layout.Section>
        <Card>
          <Box padding="400">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="400">
                <Select
                  label="Period"
                  options={periodOptions}
                  value={selectedPeriod}
                  onChange={setSelectedPeriod}
                  labelHidden
                />
                <Select
                  label="View"
                  options={viewOptions}
                  value={viewMode}
                  onChange={setViewMode}
                  labelHidden
                />
              </InlineStack>
              <Button
                icon={ExportIcon}
                onClick={() => exportData('orders')}
              >
                Export Data
              </Button>
            </InlineStack>
          </Box>
        </Card>
      </Layout.Section>

      {/* Desktop Metrics Grid */}
      <Layout.Section>
        <BlockStack gap="400">
          <Text variant="headingLg" as="h2">Key Metrics</Text>

          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2 }}>
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" tone="subdued">Total Revenue</Text>
                    <Text variant="headingXl" as="p">{formatPrice(metrics.total_revenue)}</Text>
                    <Text variant="bodyMd" tone="subdued">All time</Text>
                  </BlockStack>
                </Box>
              </Card>
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2 }}>
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" tone="subdued">Today's Revenue</Text>
                    <Text variant="headingXl" as="p">{formatPrice(metrics.today_revenue)}</Text>
                    {typeof metrics.growth_percentage === 'number' && metrics.growth_percentage !== 0 ? (
                      <InlineStack gap="200">
                        {metrics.growth_percentage > 0 ? (
                          <>
                            <Icon source={ArrowUpIcon} tone="success" />
                            <Text variant="bodyMd" tone="success">+{metrics.growth_percentage}%</Text>
                          </>
                        ) : (
                          <>
                            <Icon source={ArrowDownIcon} tone="critical" />
                            <Text variant="bodyMd" tone="critical">{metrics.growth_percentage}%</Text>
                          </>
                        )}
                      </InlineStack>
                    ) : null}
                  </BlockStack>
                </Box>
              </Card>
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2 }}>
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" tone="subdued">Total Orders</Text>
                    <Text variant="headingXl" as="p">{metrics.total_orders || 0}</Text>
                    <Text variant="bodyMd" tone="subdued">All time</Text>
                  </BlockStack>
                </Box>
              </Card>
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2 }}>
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" tone="subdued">Total Customers</Text>
                    <Text variant="headingXl" as="p">{metrics.total_customers || 0}</Text>
                    <Text variant="bodyMd" tone="subdued">Registered</Text>
                  </BlockStack>
                </Box>
              </Card>
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2 }}>
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" tone="subdued">Avg Order Value</Text>
                    <Text variant="headingXl" as="p">{formatPrice(metrics.avg_order_value)}</Text>
                    <Text variant="bodyMd" tone="subdued">Per order</Text>
                  </BlockStack>
                </Box>
              </Card>
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2 }}>
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" tone="subdued">Low Stock Alert</Text>
                    <Text variant="headingXl" as="p">{metrics.low_stock_alert || 0}</Text>
                    <Text variant="bodyMd" tone="subdued">Products &lt; 10</Text>
                  </BlockStack>
                </Box>
              </Card>
            </Grid.Cell>
          </Grid>
        </BlockStack>
      </Layout.Section>

      {/* Desktop Revenue Chart */}
      <Layout.Section>
        <Card>
          <Box padding="400">
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingLg" as="h2">
                  {viewMode === 'daily' ? 'Daily Revenue' : 'Monthly Revenue'}
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  {viewMode === 'daily' ? `Last ${selectedPeriod} days` : 'Last 12 months'}
                </Text>
              </InlineStack>

              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '200px',
                gap: '8px',
                padding: '20px 0',
                overflowX: 'auto'
              }}>
                {currentSeries.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: 1,
                      minWidth: '40px'
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '30px',
                        height: maxRevenue > 0 ? `${((item.revenue || 0) / maxRevenue) * 150}px` : '2px',
                        minHeight: '2px',
                        backgroundColor: '#5c6ac4',
                        borderRadius: '4px 4px 0 0',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      title={`${formatPrice(item.revenue)} - ${item.orders || 0} orders`}
                    />
                    <div style={{
                      marginTop: '8px',
                      fontSize: '10px',
                      color: '#637381',
                      textAlign: 'center',
                      whiteSpace: 'nowrap'
                    }}>
                      {viewMode === 'daily'
                        ? (item.date ? new Date(item.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '')
                        : (item.month || '')
                      }
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#202223',
                      marginTop: '4px'
                    }}>
                      {formatPrice(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </BlockStack>
          </Box>
        </Card>
      </Layout.Section>

      {/* Desktop Low Stock - Como Card sutil, no Banner amarillo */}
      {lowStockProducts.length > 0 && (
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h3">Low Stock Products</Text>
                  <Badge tone="warning">{lowStockProducts.length} products</Badge>
                </InlineStack>

                <div style={{ overflowX: 'auto' }}>
                  <DataTable
                    columnContentTypes={['text', 'text', 'numeric', 'numeric']}
                    headings={['Product', 'Category', 'Stock', 'Price']}
                    rows={lowStockProducts.slice(0, 5).map(product => [
                      product.name,
                      product.category,
                      <Badge tone={product.stock < 5 ? 'critical' : 'warning'}>
                        {product.stock} units
                      </Badge>,
                      formatPrice(product.price)
                    ])}
                  />
                </div>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>
      )}

      {/* Desktop Products & Categories Grid */}
      <Layout.Section>
        <Grid>
          <Grid.Cell columnSpan={{ xs: 12, sm: 6, md: 6, lg: 6 }}>
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h3">Top Products</Text>
                    <Button plain onClick={() => exportData('products')}>Export</Button>
                  </InlineStack>

                  {topProducts.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <DataTable
                        columnContentTypes={['text', 'numeric', 'numeric']}
                        headings={['Product', 'Units', 'Revenue']}
                        rows={topProducts.slice(0, 5).map(product => [
                          product.name,
                          product.units_sold,
                          formatPrice(product.revenue)
                        ])}
                      />
                    </div>
                  ) : (
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      No sales data available yet
                    </Text>
                  )}
                </BlockStack>
              </Box>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 12, sm: 6, md: 6, lg: 6 }}>
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Categories</Text>

                  {categories.length > 0 ? (
                    <BlockStack gap="200">
                      {categories.slice(0, 5).map((category, index) => (
                        <div key={index}>
                          <InlineStack align="space-between" blockAlign="center">
                            <Text variant="bodyMd">{category.category}</Text>
                            <InlineStack gap="200">
                              <Badge>{category.percentage}%</Badge>
                              <Text variant="bodyMd" tone="subdued">
                                {formatPrice(category.revenue)}
                              </Text>
                            </InlineStack>
                          </InlineStack>
                          <div style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: '#f1f2f4',
                            borderRadius: '4px',
                            marginTop: '8px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${category.percentage}%`,
                              height: '100%',
                              backgroundColor: '#5c6ac4',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      ))}
                    </BlockStack>
                  ) : (
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      No category data available
                    </Text>
                  )}
                </BlockStack>
              </Box>
            </Card>
          </Grid.Cell>
        </Grid>
      </Layout.Section>

      {/* Desktop Top Customers Table */}
      <Layout.Section>
        <Card>
          <Box padding="400">
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h3">Top Customers</Text>
                <Button plain onClick={() => exportData('customers')}>Export</Button>
              </InlineStack>

              {topCustomers.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <DataTable
                    columnContentTypes={['text', 'text', 'numeric', 'numeric']}
                    headings={['Customer', 'Email', 'Orders', 'Total Spent']}
                    rows={topCustomers.map(customer => [
                      customer.username,
                      customer.email,
                      customer.total_orders,
                      formatPrice(customer.total_spent)
                    ])}
                  />
                </div>
              ) : (
                <Text variant="bodySm" tone="subdued" alignment="center">
                  No customer data available yet
                </Text>
              )}
            </BlockStack>
          </Box>
        </Card>
      </Layout.Section>
    </Layout>
  );
};

export default Analytics;