import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  Layout,
  Text,
  Spinner,
  Select,
  InlineStack,
  Grid,
  Box,
  Button,
  Banner,
  BlockStack
} from "@shopify/polaris";
import { ArrowDownIcon } from "@shopify/polaris-icons";

// Componentes importados
import MetricCard from "../analytics/MetricCard";
import RevenueChart from "../analytics/RevenueChart";
import LowStockTable from "../analytics/LowStockTable";
import TopProductsTable from "../analytics/TopProductsTable";
import CategoriesList from "../analytics/CategoriesList";
import TopCustomersTable from "../analytics/TopCustomersTable";

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({
    total_revenue: 0,
    today_revenue: 0,
    total_orders: 0,
    total_customers: 0,
    avg_order_value: 0,
    low_stock_alert: 0,
    growth_percentage: 0
  });
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("7");
  const [viewMode, setViewMode] = useState("daily");

  // Obtener token de localStorage - tu app original lo guarda así
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('ecommerce-jwt-token');
    return token ? {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    } : {
      'Content-Type': 'application/json'
    };
  };

  // Función para formatear precios en euros
  const formatPrice = useCallback((value) =>
    `€${Number(value || 0).toFixed(2)}`, []
  );

  // Opciones de período y vista
  const periodOptions = [
    { label: "Last 7 days", value: "7" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 90 days", value: "90" }
  ];

  const viewOptions = [
    { label: "Daily", value: "daily" },
    { label: "Monthly", value: "monthly" }
  ];

  // Cargar datos cuando el componente se monta o cambia el período
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        setError(null);

        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const headers = getAuthHeaders();

        // Llamadas paralelas con Promise.allSettled para manejar errores individuales
        const [
          metricsRes,
          dailyRes,
          monthlyRes,
          topProductsRes,
          lowStockRes,
          topCustomersRes,
          categoriesRes
        ] = await Promise.allSettled([
          fetch(`${API_URL}/api/analytics/dashboard`, { headers }),
          fetch(`${API_URL}/api/analytics/revenue/daily?days=${selectedPeriod}`, { headers }),
          fetch(`${API_URL}/api/analytics/revenue/monthly`, { headers }),
          fetch(`${API_URL}/api/analytics/products/top?limit=10`, { headers }),
          fetch(`${API_URL}/api/analytics/products/low-stock`, { headers }),
          fetch(`${API_URL}/api/analytics/customers/top`, { headers }),
          fetch(`${API_URL}/api/analytics/categories/performance`, { headers })
        ]);

        // Procesar respuestas con manejo de errores
        const processResponse = async (result) => {
          if (result.status === 'fulfilled' && result.value.ok) {
            try {
              return await result.value.json();
            } catch {
              return null;
            }
          }
          return null;
        };

        const [
          metricsData,
          dailyData,
          monthlyData,
          topProductsData,
          lowStockData,
          topCustomersData,
          categoriesData
        ] = await Promise.all([
          processResponse(metricsRes),
          processResponse(dailyRes),
          processResponse(monthlyRes),
          processResponse(topProductsRes),
          processResponse(lowStockRes),
          processResponse(topCustomersRes),
          processResponse(categoriesRes)
        ]);

        // Actualizar estados con los datos recibidos o valores por defecto
        setMetrics(metricsData || {
          total_revenue: 0,
          today_revenue: 0,
          total_orders: 0,
          total_customers: 0,
          avg_order_value: 0,
          low_stock_alert: 0
        });

        setDailyRevenue(Array.isArray(dailyData) ? dailyData : (dailyData?.data || []));
        setMonthlyRevenue(Array.isArray(monthlyData) ? monthlyData : (monthlyData?.data || []));
        
        // Manejar diferentes estructuras de respuesta
        if (topProductsData?.products) {
          setTopProducts(topProductsData.products);
        } else {
          setTopProducts(Array.isArray(topProductsData) ? topProductsData : []);
        }

        setLowStockProducts(Array.isArray(lowStockData) ? lowStockData : []);

        if (topCustomersData?.customers) {
          setTopCustomers(topCustomersData.customers);
        } else {
          setTopCustomers(Array.isArray(topCustomersData) ? topCustomersData : []);
        }

        setCategories(Array.isArray(categoriesData) ? categoriesData : []);

        // Si no hay datos reales, usar datos demo
        const hasRealData = metricsData || dailyData || monthlyData;
        if (!hasRealData) {
          console.log('No real data available, using demo data');
          setError('Using demo data - Backend may not be configured');
          
          // Datos demo para visualización
          setMetrics({
            total_revenue: 15234.50,
            today_revenue: 543.20,
            total_orders: 127,
            total_customers: 89,
            avg_order_value: 120.11,
            low_stock_alert: 5,
            growth_percentage: 12.5
          });
          
          setDailyRevenue([
            { date: '2024-09-04', revenue: 420.50 },
            { date: '2024-09-05', revenue: 380.75 },
            { date: '2024-09-06', revenue: 510.20 },
            { date: '2024-09-07', revenue: 450.00 },
            { date: '2024-09-08', revenue: 490.30 },
            { date: '2024-09-09', revenue: 520.80 },
            { date: '2024-09-10', revenue: 543.20 }
          ]);
          
          setTopProducts([
            { name: 'Premium Headphones', units_sold: 45, revenue: 4500 },
            { name: 'Wireless Mouse', units_sold: 38, revenue: 1520 },
            { name: 'USB-C Hub', units_sold: 32, revenue: 960 }
          ]);
          
          setLowStockProducts([
            { name: 'Mechanical Keyboard', stock: 3, price: 89.99 },
            { name: 'Webcam HD', stock: 5, price: 59.99 }
          ]);
          
          setTopCustomers([
            { username: 'John Doe', total_orders: 12, total_spent: 1580.50 },
            { username: 'Jane Smith', total_orders: 8, total_spent: 920.30 }
          ]);
          
          setCategories([
            { category: 'Electronics', revenue: 8500, percentage: 65 },
            { category: 'Accessories', revenue: 3200, percentage: 35 }
          ]);
        }

      } catch (err) {
        console.error('Error fetching analytics data:', err);
        setError('Error loading analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [selectedPeriod]);

  // Función para exportar datos
  const handleExportData = useCallback(async (type) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(selectedPeriod));
      
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

      const response = await fetch(
        `${API_URL}/api/analytics/export?${params}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics_${type}_${formatDate(endDate)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error exporting data:', err);
      // Fallback: exportar datos actuales en memoria
      const dataToExport = type === 'products' ? topProducts : 
                           type === 'customers' ? topCustomers : 
                           viewMode === 'daily' ? dailyRevenue : monthlyRevenue;
      
      if (dataToExport.length === 0) return;
      
      const csvContent = dataToExport.map(item => 
        Object.values(item).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_export.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    }
  }, [selectedPeriod, topProducts, topCustomers, dailyRevenue, monthlyRevenue, viewMode]);

  // Memorizar la serie actual
  const currentSeries = useMemo(() => 
    viewMode === "daily" ? dailyRevenue : monthlyRevenue,
    [viewMode, dailyRevenue, monthlyRevenue]
  );

  // Loading state
  if (loading) {
    return (
      <Card sectioned>
        <div style={{ textAlign: "center", padding: "50px" }}>
          <Spinner size="large" />
          <div style={{ marginTop: "20px" }}>
            <Text variant="bodyMd">Loading analytics data...</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Layout>
      {/* Mostrar banner si hay error pero con datos */}
      {error && (
        <Layout.Section>
          <Banner status="warning" title="Analytics Notice">
            <p>{error}</p>
          </Banner>
        </Layout.Section>
      )}

      {/* Key Metrics */}
      <Layout.Section>
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3 }}>
            <MetricCard 
              title="Total Revenue" 
              value={formatPrice(metrics.total_revenue)} 
              subtitle="All time" 
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3 }}>
            <MetricCard 
              title="Today's Revenue" 
              value={formatPrice(metrics.today_revenue)} 
              subtitle={metrics.growth_percentage ? `${metrics.growth_percentage > 0 ? '+' : ''}${metrics.growth_percentage}%` : 'Current day'} 
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3 }}>
            <MetricCard 
              title="Total Orders" 
              value={metrics.total_orders || 0} 
              subtitle="All time" 
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3 }}>
            <MetricCard 
              title="Total Customers" 
              value={metrics.total_customers || 0} 
              subtitle="Registered" 
            />
          </Grid.Cell>
        </Grid>
      </Layout.Section>

      {/* Controls */}
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
                icon={ArrowDownIcon} 
                onClick={() => handleExportData('orders')}
                disabled={currentSeries.length === 0}
              >
                Export Data
              </Button>
            </InlineStack>
          </Box>
        </Card>
      </Layout.Section>

      {/* Revenue Chart */}
      {currentSeries.length > 0 && (
        <Layout.Section>
          <RevenueChart 
            data={currentSeries} 
            viewMode={viewMode} 
            formatPrice={formatPrice} 
          />
        </Layout.Section>
      )}

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Layout.Section>
          <LowStockTable 
            products={lowStockProducts} 
            formatPrice={formatPrice} 
          />
        </Layout.Section>
      )}

      {/* Products and Categories */}
      <Layout.Section>
        <BlockStack gap="400">
          <TopProductsTable 
            products={topProducts} 
            formatPrice={formatPrice} 
            onExport={() => handleExportData('products')} 
          />
          <CategoriesList 
            categories={categories} 
            formatPrice={formatPrice} 
          />
        </BlockStack>
      </Layout.Section>

      {/* Top Customers */}
      <Layout.Section>
        <TopCustomersTable 
          customers={topCustomers} 
          formatPrice={formatPrice} 
          onExport={() => handleExportData('customers')} 
        />
      </Layout.Section>
    </Layout>
  );
};

export default Analytics;