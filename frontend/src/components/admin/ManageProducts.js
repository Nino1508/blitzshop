// frontend/src/components/admin/ManageProducts.js

import React, { useState, useEffect } from 'react';
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
  ButtonGroup,
  Filters,
  ChoiceList,
  Pagination,
  Toast,
  Frame,
  DropZone,
  Thumbnail,
  Text
} from '@shopify/polaris';
import { DeleteIcon, EditIcon, ViewIcon } from '@shopify/polaris-icons';
import api from '../../services/api';

const ManageProducts = () => {
  // Estados principales
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  
  // Estados de modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Estados de formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    stock_quantity: '0',
    discount_percentage: '0',
    is_active: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // Estados de filtros
  const [queryValue, setQueryValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Estados de UI
  const [toast, setToast] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [currentPage, queryValue, selectedCategory]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        per_page: 10,
        ...(queryValue && { search: queryValue }),
        ...(selectedCategory && { category: selectedCategory })
      });
      
      const response = await api.get(`/api/admin/products?${params}`);
      setProducts(response.data.products || []);
      setPagination(response.data.pagination || {});
    } catch (error) {
      showToast('Error loading products', 'error');
      setProducts([]);
      setPagination({});
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/admin/categories');
      setCategories(response.data.categories.map(cat => ({ label: cat, value: cat })));
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Funciones de modal
  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      stock_quantity: '0',
      discount_percentage: '0',
      is_active: true
    });
    setImageFile(null);
    setImagePreview(null);
    setShowCreateModal(true);
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price ? product.price.toString() : '',
      category: product.category || '',
      stock_quantity: product.stock_quantity ? product.stock_quantity.toString() : '0',
      discount_percentage: product.discount_percentage ? product.discount_percentage.toString() : '0',
      is_active: product.is_active !== undefined ? product.is_active : true
    });
    setImageFile(null);
    setImagePreview(product.image_url || null);
    setShowEditModal(true);
  };

  const openDeleteModal = (product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  // Image handling
  const handleImageDrop = (files) => {
    const file = files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Funciones CRUD
  const handleCreateProduct = async () => {
    try {
      setFormLoading(true);
      
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('price', formData.price);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('stock_quantity', formData.stock_quantity);
      formDataToSend.append('discount_percentage', formData.discount_percentage);
      formDataToSend.append('is_active', formData.is_active.toString());
      
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }
      
      await api.post('/api/admin/products', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setShowCreateModal(false);
      loadProducts();
      showToast('Product created successfully!');
    } catch (error) {
      showToast(error.response?.data?.error || 'Error creating product', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateProduct = async () => {
    try {
      setFormLoading(true);
      
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('price', formData.price);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('stock_quantity', formData.stock_quantity);
      formDataToSend.append('discount_percentage', formData.discount_percentage);
      formDataToSend.append('is_active', formData.is_active.toString());
      
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }
      
      await api.put(`/api/admin/products/${selectedProduct.id}`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setShowEditModal(false);
      loadProducts();
      showToast('Product updated successfully!');
    } catch (error) {
      showToast(error.response?.data?.error || 'Error updating product', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    try {
      setFormLoading(true);
      await api.delete(`/api/admin/products/${selectedProduct.id}`);
      setShowDeleteModal(false);
      loadProducts();
      showToast('Product deleted successfully!');
    } catch (error) {
      showToast(error.response?.data?.error || 'Error deleting product', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleProductStatus = async (product) => {
    try {
      await api.patch(`/api/admin/products/${product.id}/toggle-status`);
      loadProducts();
      showToast(`Product ${product.is_active ? 'deactivated' : 'activated'} successfully!`);
    } catch (error) {
      showToast('Error toggling product status', 'error');
    }
  };

  // Filter configuration
  const handleFiltersQueryChange = (value) => {
    setQueryValue(value);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (value) => {
    setSelectedCategory(value[0] || '');
    setCurrentPage(1);
  };

  const handleFiltersClearAll = () => {
    setQueryValue('');
    setSelectedCategory('');
    setCurrentPage(1);
  };

  // Table configuration
  const rows = products.map((product) => [
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {product.image_url && (
        <Thumbnail
          source={product.image_url}
          alt={product.name}
          size="small"
        />
      )}
      <div>
        <strong>{product.name}</strong>
        <div>
          <Text variant="bodySm" color="subdued">{product.category}</Text>
        </div>
      </div>
    </div>,
    product.discount_percentage > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Text tone="subdued" textDecorationLine="line-through">€{product.price}</Text>
          <Text tone="success" fontWeight="semibold">
            €{(product.price * (1 - product.discount_percentage/100)).toFixed(2)}
          </Text>
        </div>
        <Badge tone="critical" size="small">-{product.discount_percentage}%</Badge>
      </div>
    ) : (
      `€${product.price}`
    ),
    product.stock_quantity || 0,
    <Badge status={product.is_active ? 'success' : 'critical'}>
      {product.is_active ? 'Active' : 'Inactive'}
    </Badge>,
    <ButtonGroup>
      <Button
        icon={ViewIcon}
        onClick={() => toggleProductStatus(product)}
        size="slim"
      >
        {product.is_active ? 'Deactivate' : 'Activate'}
      </Button>
      <Button
        icon={EditIcon}
        onClick={() => openEditModal(product)}
        size="slim"
      >
        Edit
      </Button>
      <Button
        icon={DeleteIcon}
        onClick={() => openDeleteModal(product)}
        destructive
        size="slim"
      >
        Delete
      </Button>
    </ButtonGroup>
  ]);

  const filters = [
    {
      key: 'category',
      label: 'Category',
      filter: (
        <ChoiceList
          title="Category"
          titleHidden
          choices={categories}
          selected={selectedCategory ? [selectedCategory] : []}
          onChange={handleCategoryFilterChange}
          allowMultiple={false}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (selectedCategory) {
    appliedFilters.push({
      key: 'category',
      label: `Category: ${selectedCategory}`,
      onRemove: () => setSelectedCategory(''),
    });
  }

  const productForm = (
    <FormLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <TextField
          label="Product Name"
          value={formData.name}
          onChange={(value) => setFormData({ ...formData, name: value })}
          placeholder="Enter product name"
          required
        />
        
        <TextField
          label="Description"
          value={formData.description}
          onChange={(value) => setFormData({ ...formData, description: value })}
          placeholder="Product description"
          multiline={3}
        />
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <TextField
            label="Price (€)"
            type="number"
            value={formData.price}
            onChange={(value) => setFormData({ ...formData, price: value })}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />
          
          <TextField
            label="Stock Quantity"
            type="number"
            value={formData.stock_quantity}
            onChange={(value) => setFormData({ ...formData, stock_quantity: value })}
            placeholder="0"
            min="0"
            required
          />
        </div>
        
        <TextField
          label="Discount (%)"
          type="number"
          value={formData.discount_percentage}
          onChange={(value) => setFormData({ ...formData, discount_percentage: value })}
          placeholder="0"
          suffix="%"
          min="0"
          max="99"
          helpText="Leave 0 for no discount"
        />
        
        <Select
          label="Category"
          options={[
            { label: 'Select category...', value: '' },
            ...categories
          ]}
          value={formData.category}
          onChange={(value) => setFormData({ ...formData, category: value })}
          required
        />
        
        <Checkbox
          label="Product is active"
          checked={formData.is_active}
          onChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        
        <div>
          <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            Product Image
          </label>
          {imagePreview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Thumbnail source={imagePreview} alt="Preview" size="large" />
              <Button onClick={removeImage} size="slim">Remove Image</Button>
            </div>
          ) : (
            <DropZone onDrop={handleImageDrop} accept="image/*">
              <DropZone.FileUpload />
            </DropZone>
          )}
        </div>
      </div>
    </FormLayout>
  );

  return (
    <Frame>
      <Page
        title="Manage Products"
        primaryAction={{
          content: 'Add Product',
          onAction: openCreateModal,
        }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <Filters
                  queryValue={queryValue}
                  filters={filters}
                  appliedFilters={appliedFilters}
                  onQueryChange={handleFiltersQueryChange}
                  onQueryClear={() => setQueryValue('')}
                  onClearAll={handleFiltersClearAll}
                  queryPlaceholder="Search products..."
                />
              </div>
              
              <DataTable
                columnContentTypes={['text', 'text', 'numeric', 'text', 'text']}
                headings={['Product', 'Price', 'Stock', 'Status', 'Actions']}
                rows={rows}
                loading={loading}
              />
              
              {pagination && pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                  <Pagination
                    hasPrevious={pagination?.has_prev || false}
                    onPrevious={() => setCurrentPage(currentPage - 1)}
                    hasNext={pagination?.has_next || false}
                    onNext={() => setCurrentPage(currentPage + 1)}
                    label={`${currentPage} / ${pagination?.pages || 1}`}
                  />
                </div>
              )}
            </Card>
          </Layout.Section>
        </Layout>

        {/* Create Product Modal */}
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Product"
          primaryAction={{
            content: 'Create Product',
            onAction: handleCreateProduct,
            loading: formLoading,
            disabled: !formData.name || !formData.price || !formData.category
          }}
          secondaryActions={[{
            content: 'Cancel',
            onAction: () => setShowCreateModal(false)
          }]}
        >
          <Modal.Section>
            {productForm}
          </Modal.Section>
        </Modal>

        {/* Edit Product Modal */}
        <Modal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Product"
          primaryAction={{
            content: 'Update Product',
            onAction: handleUpdateProduct,
            loading: formLoading
          }}
          secondaryActions={[{
            content: 'Cancel',
            onAction: () => setShowEditModal(false)
          }]}
        >
          <Modal.Section>
            {productForm}
          </Modal.Section>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Product"
          primaryAction={{
            content: 'Delete',
            onAction: handleDeleteProduct,
            loading: formLoading,
            destructive: true
          }}
          secondaryActions={[{
            content: 'Cancel',
            onAction: () => setShowDeleteModal(false)
          }]}
        >
          <Modal.Section>
            <p>
              Are you sure you want to delete <strong>{selectedProduct?.name}</strong>?
            </p>
            <p>This action cannot be undone.</p>
          </Modal.Section>
        </Modal>

        {/* Toast */}
        {toast && (
          <Toast
            content={toast.message}
            error={toast.type === 'error'}
            onDismiss={() => setToast(null)}
          />
        )}
      </Page>
    </Frame>
  );
};

export default ManageProducts;