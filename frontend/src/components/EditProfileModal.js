import React, { useState, useCallback } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  Banner,
  BlockStack,
  Select,
  Checkbox,
  Divider,
  Text
} from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';
import countryList from 'country-list';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const EditProfileModal = ({ open, onClose, user, onSuccess }) => {
  const { getAuthToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isCompany, setIsCompany] = useState(false);
  
  // Lista completa de países del mundo - 249 países
  const countryOptions = countryList.getData().map(country => ({
    label: country.name,
    value: country.code.toUpperCase()
  }));
  
  // Form fields - incluir TODOS los campos profesionales
  const [formData, setFormData] = useState({
    // Datos básicos
    username: user?.username || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    
    // Contacto
    phone: user?.phone || '',
    
    // Dirección
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    postal_code: user?.postal_code || '',
    country: user?.country || 'ES',
    
    // Empresa
    company_name: user?.company_name || '',
    tax_id: user?.tax_id || ''
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (open && !success) {
      setFormData({
        username: user?.username || '',
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        address: user?.address || '',
        city: user?.city || '',
        state: user?.state || '',
        postal_code: user?.postal_code || '',
        country: user?.country || 'ES',
        company_name: user?.company_name || '',
        tax_id: user?.tax_id || ''
      });
      setIsCompany(!!user?.company_name);
      setError(null);
      setSuccess(false);
    }
  }, [open, user, success]);

  const handleChange = useCallback((value, field) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  }, []);

  const handleCompanyToggle = useCallback((newChecked) => {
    setIsCompany(newChecked);
    if (!newChecked) {
      // Si desactiva empresa, limpiar campos
      setFormData(prev => ({
        ...prev,
        company_name: '',
        tax_id: ''
      }));
    }
  }, []);

  const validateForm = () => {
    // Validaciones básicas
    if (!formData.first_name.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.last_name.trim()) {
      setError('Last name is required');
      return false;
    }
    
    // Validar teléfono si está presente
    if (formData.phone && formData.phone.length < 9) {
      setError('Please enter a valid phone number');
      return false;
    }
    
    // Validar código postal español
    if (formData.postal_code && formData.country === 'ES') {
      if (formData.postal_code.length !== 5 || !/^\d{5}$/.test(formData.postal_code)) {
        setError('Spanish postal code must be 5 digits');
        return false;
      }
    }
    
    // Si es empresa, tax_id es obligatorio
    if (isCompany && formData.company_name && !formData.tax_id) {
      setError('Tax ID is required for companies');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Preparar datos para enviar
      const dataToSend = {
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        postal_code: formData.postal_code || null,
        country: formData.country || 'ES',
        company_name: isCompany ? formData.company_name : null,
        tax_id: isCompany ? formData.tax_id : null
      };

      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(dataToSend)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update user in parent component
      if (onSuccess) {
        onSuccess(data.user);
      }

      setSuccess(true);
      setLoading(false);

      // Scroll al top del contenido del modal
      setTimeout(() => {
        // Buscar el contenedor scrolleable del Modal de Polaris
        const modalBody = document.querySelector('.Polaris-Modal__BodyWrapper');
        if (modalBody) {
          modalBody.scrollTop = 0;
        }
        // Backup: intentar con el section del modal
        const modalSection = document.querySelector('.Polaris-Modal__Section');
        if (modalSection) {
          modalSection.scrollTop = 0;
        }
        // Otro intento: buscar el contenedor con scroll
        const scrollContainer = document.querySelector('.Polaris-Scrollable');
        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
        }
      }, 100);
      
      // Close after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Profile"
      primaryAction={{
        content: 'Save Changes',
        onAction: handleSubmit,
        loading: loading,
        disabled: loading
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose,
          disabled: loading
        }
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Success Message */}
          {success && (
            <Banner tone="success" title="Success">
              <p>Profile updated successfully!</p>
            </Banner>
          )}
          
          {/* Error Message */}
          {error && (
            <Banner tone="critical" title="Error">
              <p>{error}</p>
            </Banner>
          )}

          {/* Personal Information */}
          <Text variant="headingMd" as="h2">Personal Information</Text>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="First Name"
                value={formData.first_name}
                onChange={(value) => handleChange(value, 'first_name')}
                autoComplete="given-name"
                disabled={loading}
                requiredIndicator
              />
              
              <TextField
                label="Last Name"
                value={formData.last_name}
                onChange={(value) => handleChange(value, 'last_name')}
                autoComplete="family-name"
                disabled={loading}
                requiredIndicator
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <TextField
                label="Username"
                value={formData.username}
                onChange={(value) => handleChange(value, 'username')}
                autoComplete="username"
                disabled={loading}
                helpText="Your public display name"
              />

              <TextField
                label="Phone"
                type="tel"
                value={formData.phone}
                onChange={(value) => handleChange(value, 'phone')}
                autoComplete="tel"
                disabled={loading}
                helpText="For delivery contact"
              />
            </FormLayout.Group>

            <TextField
              label="Email"
              type="email"
              value={formData.email}
              disabled={true}
              readOnly={true}
              helpText="Email cannot be changed for security reasons"
            />
          </FormLayout>

          <Divider />

          {/* Address Information */}
          <Text variant="headingMd" as="h2">Address</Text>
          <FormLayout>
            <TextField
              label="Street Address"
              value={formData.address}
              onChange={(value) => handleChange(value, 'address')}
              autoComplete="street-address"
              disabled={loading}
              helpText="Street and number"
            />

            <FormLayout.Group>
              <TextField
                label="City"
                value={formData.city}
                onChange={(value) => handleChange(value, 'city')}
                autoComplete="address-level2"
                disabled={loading}
              />

              <TextField
                label="State/Province"
                value={formData.state}
                onChange={(value) => handleChange(value, 'state')}
                autoComplete="address-level1"
                disabled={loading}
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <TextField
                label="Postal Code"
                value={formData.postal_code}
                onChange={(value) => handleChange(value, 'postal_code')}
                autoComplete="postal-code"
                disabled={loading}
                helpText="5 digits for Spain"
              />

              <Select
                label="Country"
                options={countryOptions}
                value={formData.country}
                onChange={(value) => handleChange(value, 'country')}
                disabled={loading}
              />
            </FormLayout.Group>
          </FormLayout>

          <Divider />

          {/* Company Information */}
          <Text variant="headingMd" as="h2">Business Information</Text>
          <Checkbox
            label="I'm purchasing as a company"
            checked={isCompany}
            onChange={handleCompanyToggle}
            disabled={loading}
          />

          {isCompany && (
            <FormLayout>
              <TextField
                label="Company Name"
                value={formData.company_name}
                onChange={(value) => handleChange(value, 'company_name')}
                disabled={loading}
                helpText="Legal company name for invoices"
                requiredIndicator
              />

              <TextField
                label="Tax ID (CIF/NIF)"
                value={formData.tax_id}
                onChange={(value) => handleChange(value, 'tax_id')}
                disabled={loading}
                helpText="Required for tax invoices"
                requiredIndicator
              />
            </FormLayout>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default EditProfileModal;