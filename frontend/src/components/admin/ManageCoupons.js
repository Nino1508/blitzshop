// frontend/src/components/admin/ManageCoupons.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Page,
  Layout,
  DataTable,
  Button,
  Modal,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Badge,
  InlineStack,
  BlockStack,
  Text,
  Banner,
  InlineError,
  Spinner,
  EmptyState,
  Tabs,
  ChoiceList,
  DatePicker,
  Popover,
  Grid
} from '@shopify/polaris';
import MetricCard from "../analytics/MetricCard";


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Normalization helpers (prevent '' en campos numéricos/fechas)
const num = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
const iso = (d) => (d ? new Date(d).toISOString() : null);

// Formateo de fechas sin dependencias externas
const formatDate = (dateLike) => {
  if (!dateLike) return '-';
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
};

function ManageCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [modalActive, setModalActive] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deleteModalActive, setDeleteModalActive] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    min_purchase: '',
    max_discount: '',
    usage_limit: '',
    usage_limit_per_user: '1',
    valid_from: null,
    valid_until: null,
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});

  // Date picker states
  const [validFromPopover, setValidFromPopover] = useState(false);
  const [validUntilPopover, setValidUntilPopover] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Stats
  const [stats, setStats] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  // Fetch coupons
  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const params = new URLSearchParams({
        page: currentPage,
        per_page: 10,
        search: searchValue,
        status: statusFilter
      });

      const response = await fetch(`${API_URL}/api/coupons?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch coupons');
      const data = await response.json();
      setCoupons(data.coupons || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchValue, statusFilter]);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(`${API_URL}/api/coupons/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchCoupons();
    fetchStats();
  }, [fetchCoupons]);

  // Handle form submission
  const handleSubmit = async () => {
    setFormErrors({});
    // Basic validation
    const errors = {};
    if (!formData.code) errors.code = 'Coupon code is required';
    if (!formData.discount_value || parseFloat(formData.discount_value) <= 0) {
      errors.discount_value = 'Valid discount value required';
    }
    if (formData.discount_type === 'percentage' && parseFloat(formData.discount_value) > 100) {
      errors.discount_value = 'Percentage cannot exceed 100%';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Normalize payload ('' → null, números → Number, fechas → ISO)
    const payload = {
      code: (formData.code || '').toUpperCase(),
      description: formData.description || '',
      discount_type: formData.discount_type || 'percentage',
      discount_value: num(formData.discount_value) ?? 0,
      min_purchase: num(formData.min_purchase),
      max_discount: formData.discount_type === 'percentage' ? num(formData.max_discount) : null,
      usage_limit: num(formData.usage_limit),
      usage_limit_per_user: num(formData.usage_limit_per_user) ?? 1,
      // valid_from: si lo dejas null, el backend pondrá now; lo mandamos solo si existe
      valid_from: formData.valid_from ? iso(formData.valid_from) : null,
      valid_until: formData.valid_until ? iso(formData.valid_until) : null,
      is_active: !!formData.is_active
    };

    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const url = editingCoupon
        ? `${API_URL}/api/coupons/${editingCoupon.id}`
        : `${API_URL}/api/coupons`;
      const method = editingCoupon ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save coupon');
      }

      setSuccessBanner(editingCoupon ? 'Coupon updated successfully' : 'Coupon created successfully');
      setModalActive(false);
      resetForm();
      fetchCoupons();
      fetchStats();
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err) {
      setFormErrors({ submit: err.message });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(`${API_URL}/api/coupons/${couponToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete coupon');
      setSuccessBanner('Coupon deleted successfully');
      setDeleteModalActive(false);
      fetchCoupons();
      fetchStats();
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_purchase: '',
      max_discount: '',
      usage_limit: '',
      usage_limit_per_user: '1',
      valid_from: null,
      valid_until: null,
      is_active: true
    });
    setEditingCoupon(null);
    setFormErrors({});
  };

  // Open edit modal
  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value?.toString?.() ?? '',
      min_purchase: coupon.min_purchase != null ? String(coupon.min_purchase) : '',
      max_discount: coupon.max_discount != null ? String(coupon.max_discount) : '',
      usage_limit: coupon.usage_limit != null ? String(coupon.usage_limit) : '',
      usage_limit_per_user: coupon.usage_limit_per_user != null ? String(coupon.usage_limit_per_user) : '1',
      valid_from: coupon.valid_from ? new Date(coupon.valid_from) : null,
      valid_until: coupon.valid_until ? new Date(coupon.valid_until) : null,
      is_active: !!coupon.is_active
    });
    setModalActive(true);
  };

  // Get status badge
  const getStatusBadge = (coupon) => {
    const now = new Date();
    const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
    const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;
    if (!coupon.is_active) return <Badge tone="critical">Inactive</Badge>;
    if (validUntil && validUntil < now) return <Badge tone="warning">Expired</Badge>;
    if (validFrom && validFrom > now) return <Badge tone="info">Scheduled</Badge>;
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) return <Badge tone="warning">Limit Reached</Badge>;
    return <Badge tone="success">Active</Badge>;
  };

  // Table rows
  const rows = coupons.map(coupon => [
    <Text variant="bodyMd" fontWeight="bold">{coupon.code}</Text>,
    coupon.description || '-',
    coupon.discount_type === 'percentage'
      ? `${coupon.discount_value}%`
      : `€${coupon.discount_value}`,
    coupon.min_purchase != null ? `€${coupon.min_purchase}` : '-',
    `${coupon.usage_count || 0}${coupon.usage_limit ? `/${coupon.usage_limit}` : ''}`,
    formatDate(coupon.valid_until),
    getStatusBadge(coupon),
    <InlineStack gap="2">
      <Button size="slim" onClick={() => openEditModal(coupon)}>Edit</Button>
      <Button
        size="slim"
        tone="critical"
        onClick={() => {
          setCouponToDelete(coupon);
          setDeleteModalActive(true);
        }}
      >
        Delete
      </Button>
    </InlineStack>
  ]);

  const tabs = [
    { id: 'coupons', content: 'Coupons', panelID: 'coupons-panel' },
    { id: 'stats', content: 'Statistics', panelID: 'stats-panel' }
  ];

  if (loading && coupons.length === 0) {
    return (
      <Page title="Manage Coupons">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <Spinner size="large" />
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Manage Coupons"
      primaryAction={{
        content: 'Create Coupon',
        onAction: () => {
          resetForm();
          setModalActive(true);
        }
      }}
    >
      <Layout>
        {successBanner && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessBanner(null)}>
              {successBanner}
            </Banner>
          </Layout.Section>
        )}

        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              {selectedTab === 0 && (
                <div style={{ padding: '16px' }}>
                  <BlockStack gap="4">
                    <InlineStack gap="4">
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Search coupons"
                          value={searchValue}
                          onChange={(value) => {
                            setSearchValue(value);
                            setCurrentPage(1);
                          }}
                          placeholder="Search by code or description"
                          clearButton
                          onClearButtonClick={() => setSearchValue('')}
                        />
                      </div>
                      <Select
                        label="Status"
                        options={[
                          { label: 'All', value: 'all' },
                          { label: 'Active', value: 'active' },
                          { label: 'Expired', value: 'expired' },
                          { label: 'Inactive', value: 'inactive' }
                        ]}
                        value={statusFilter}
                        onChange={(value) => {
                          setStatusFilter(value);
                          setCurrentPage(1);
                        }}
                      />
                    </InlineStack>

                    {coupons.length > 0 ? (
                      <DataTable
                        columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text']}
                        headings={['Code', 'Description', 'Discount', 'Min Purchase', 'Usage', 'Expires', 'Status', 'Actions']}
                        rows={rows}
                      />
                    ) : (
                      <EmptyState
                        heading="No coupons found"
                        action={{ content: 'Create first coupon', onAction: () => setModalActive(true) }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>Create discount coupons to offer special deals to your customers.</p>
                      </EmptyState>
                    )}

                    {totalPages > 1 && (
                      <InlineStack align="center" gap="2">
                        <Button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                          Previous
                        </Button>
                        <Text>Page {currentPage} of {totalPages}</Text>
                        <Button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                          Next
                        </Button>
                      </InlineStack>
                    )}
                  </BlockStack>
                </div>
              )}

              {selectedTab === 1 && stats && (
                <div style={{ padding: '16px' }}>
                  <BlockStack gap="400">
                    <Grid>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4 }}>
                        <MetricCard
                          title="Total Coupons"
                          value={stats.total_coupons}
                          subtitle={`${stats.active_coupons} active`}
                        />
                      </Grid.Cell>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4 }}>
                        <MetricCard
                          title="Total Usage"
                          value={stats.total_usage}
                          subtitle="Times used"
                        />
                      </Grid.Cell>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4 }}>
                        <MetricCard
                          title="Total Discount"
                          value={`€${stats.total_discount_given.toFixed(2)}`}
                          subtitle="Given to customers"
                        />
                      </Grid.Cell>
                    </Grid>

                    {stats.most_used_coupons.length > 0 && (
                      <Card>
                        <BlockStack gap="3">
                          <Text variant="headingMd">Most Used Coupons</Text>
                          <DataTable
                            columnContentTypes={['text', 'numeric', 'text']}
                            headings={['Code', 'Times Used', 'Discount']}
                            rows={stats.most_used_coupons.map(c => [
                              c.code,
                              c.usage_count,
                              c.discount_type === 'percentage'
                                ? `${c.discount_value}%`
                                : `€${c.discount_value}`
                            ])}
                          />
                        </BlockStack>
                      </Card>
                    )}
                  </BlockStack>
                </div>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Create/Edit Modal */}
      <Modal
        open={modalActive}
        onClose={() => {
          setModalActive(false);
          resetForm();
        }}
        title={editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
        primaryAction={{ content: editingCoupon ? 'Update' : 'Create', onAction: handleSubmit }}
        secondaryActions={[{ content: 'Cancel', onAction: () => { setModalActive(false); resetForm(); } }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Coupon Code"
              value={formData.code}
              onChange={(value) => setFormData({ ...formData, code: value.toUpperCase() })}
              error={formErrors.code}
              placeholder="e.g., SAVE20"
              maxLength={50}
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder="e.g., 20% off for new customers"
              maxLength={200}
            />

            <FormLayout.Group>
              <Select
                label="Discount Type"
                options={[
                  { label: 'Percentage', value: 'percentage' },
                  { label: 'Fixed Amount', value: 'fixed' }
                ]}
                value={formData.discount_type}
                onChange={(value) => setFormData({ ...formData, discount_type: value })}
              />

              <TextField
                label={formData.discount_type === 'percentage' ? 'Discount (%)' : 'Discount (€)'}
                value={formData.discount_value}
                onChange={(value) => setFormData({ ...formData, discount_value: value })}
                error={formErrors.discount_value}
                type="number"
                min="0"
                max={formData.discount_type === 'percentage' ? "100" : undefined}
                step="0.01"
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <TextField
                label="Minimum Purchase (€)"
                value={formData.min_purchase}
                onChange={(value) => setFormData({ ...formData, min_purchase: value })}
                type="number"
                min="0"
                step="0.01"
                helpText="Leave empty for no minimum"
              />

              {formData.discount_type === 'percentage' && (
                <TextField
                  label="Maximum Discount (€)"
                  value={formData.max_discount}
                  onChange={(value) => setFormData({ ...formData, max_discount: value })}
                  type="number"
                  min="0"
                  step="0.01"
                  helpText="Cap for percentage discounts"
                />
              )}
            </FormLayout.Group>

            <FormLayout.Group>
              <TextField
                label="Total Usage Limit"
                value={formData.usage_limit}
                onChange={(value) => setFormData({ ...formData, usage_limit: value })}
                type="number"
                min="0"
                helpText="Leave empty for unlimited"
              />

              <TextField
                label="Per User Limit"
                value={formData.usage_limit_per_user}
                onChange={(value) => setFormData({ ...formData, usage_limit_per_user: value })}
                type="number"
                min="1"
                helpText="Max uses per customer"
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <Popover
                active={validFromPopover}
                activator={
                  <TextField
                    label="Valid From"
                    value={formData.valid_from ? formatDate(formData.valid_from) : ''}
                    onFocus={() => setValidFromPopover(true)}
                    placeholder="Select date"
                    helpText="Leave empty to start immediately"
                  />
                }
                onClose={() => setValidFromPopover(false)}
              >
                <div style={{ padding: '16px' }}>
                  <DatePicker
                    month={selectedMonth}
                    year={selectedYear}
                    onChange={(value) => {
                      setFormData({ ...formData, valid_from: value.start });
                      setValidFromPopover(false);
                    }}
                    onMonthChange={(month, year) => {
                      setSelectedMonth(month);
                      setSelectedYear(year);
                    }}
                    selected={formData.valid_from}
                  />
                </div>
              </Popover>

              <Popover
                active={validUntilPopover}
                activator={
                  <TextField
                    label="Valid Until"
                    value={formData.valid_until ? formatDate(formData.valid_until) : ''}
                    onFocus={() => setValidUntilPopover(true)}
                    placeholder="Select date"
                    helpText="Leave empty for no expiry"
                  />
                }
                onClose={() => setValidUntilPopover(false)}
              >
                <div style={{ padding: '16px' }}>
                  <DatePicker
                    month={selectedMonth}
                    year={selectedYear}
                    onChange={(value) => {
                      setFormData({ ...formData, valid_until: value.start });
                      setValidUntilPopover(false);
                    }}
                    onMonthChange={(month, year) => {
                      setSelectedMonth(month);
                      setSelectedYear(year);
                    }}
                    selected={formData.valid_until}
                  />
                </div>
              </Popover>
            </FormLayout.Group>

            <Checkbox
              label="Active"
              checked={formData.is_active}
              onChange={(value) => setFormData({ ...formData, is_active: value })}
              helpText="Deactivate to temporarily disable the coupon"
            />

            {formErrors.submit && <InlineError message={formErrors.submit} />}
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalActive}
        onClose={() => setDeleteModalActive(false)}
        title="Delete Coupon"
        primaryAction={{ content: 'Delete', destructive: true, onAction: handleDelete }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setDeleteModalActive(false) }]}
      >
        <Modal.Section>
          <Text>
            Are you sure you want to delete the coupon <Text fontWeight="bold">{couponToDelete?.code}</Text>?
            {couponToDelete?.usage_count > 0 && (
              <Text tone="subdued">
                <br />This coupon has been used {couponToDelete.usage_count} times and will be deactivated instead of deleted.
              </Text>
            )}
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export default ManageCoupons;