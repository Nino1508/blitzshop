// frontend/src/components/CouponInput.js
import React, { useState } from 'react';
import {
  Card,
  TextField,
  Button,
  InlineStack,
  BlockStack,
  Text,
  Badge,
  Banner,
  Spinner,
  Icon
} from '@shopify/polaris';
import { DiscountIcon, DeleteIcon } from '@shopify/polaris-icons';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function CouponInput({ cartTotal, onCouponApplied, appliedCoupon, onRemoveCoupon }) {
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validating, setValidating] = useState(false);

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const response = await fetch(`${API_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: couponCode.trim().toUpperCase(),
          cart_total: cartTotal
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid coupon');
      }

      // Success - call the parent callback
      onCouponApplied(data.coupon);
      setCouponCode('');
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    if (onRemoveCoupon) {
      onRemoveCoupon();
      setCouponCode('');
      setError(null);
    }
  };

  // If coupon is already applied, show the applied state
  if (appliedCoupon) {
    return (
      <Card>
        <BlockStack gap="3">
          <InlineStack align="space-between">
            <InlineStack gap="2" align="center">
              <Icon source={DiscountIcon} tone="success" />
              <Text variant="bodyMd" fontWeight="semibold">
                Coupon Applied
              </Text>
            </InlineStack>
            <Badge tone="success">{appliedCoupon.code}</Badge>
          </InlineStack>

          <BlockStack gap="2">
            {appliedCoupon.description && (
              <Text tone="subdued">{appliedCoupon.description}</Text>
            )}
            
            <InlineStack align="space-between">
              <Text>
                {appliedCoupon.discount_type === 'percentage'
                  ? `${appliedCoupon.discount_value}% discount`
                  : `€${appliedCoupon.discount_value} discount`}
              </Text>
              <Text fontWeight="semibold" tone="success">
                -€{appliedCoupon.discount_amount.toFixed(2)}
              </Text>
            </InlineStack>

            <div style={{ borderTop: '1px solid #e1e3e5', paddingTop: '8px', marginTop: '4px' }}>
              <InlineStack align="space-between">
                <Text fontWeight="semibold">New Total</Text>
                <Text variant="headingMd" fontWeight="semibold">
                  €{appliedCoupon.final_total.toFixed(2)}
                </Text>
              </InlineStack>
            </div>
          </BlockStack>

          <Button
            size="slim"
            tone="critical"
            icon={DeleteIcon}
            onClick={handleRemoveCoupon}
          >
            Remove Coupon
          </Button>
        </BlockStack>
      </Card>
    );
  }

  // Show the input form
  return (
    <Card>
      <BlockStack gap="3">
        <InlineStack gap="2" align="center">
          <Icon source={DiscountIcon} />
          <Text variant="bodyMd" fontWeight="semibold">
            Have a Coupon?
          </Text>
        </InlineStack>

        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        <InlineStack gap="2">
          <div style={{ flex: 1 }}>
            <TextField
              label=""
              value={couponCode}
              onChange={(value) => setCouponCode(value.toUpperCase())}
              placeholder="Enter coupon code"
              disabled={validating}
              onSubmit={validateCoupon}
              autoComplete="off"
            />
          </div>
          <Button
            primary
            onClick={validateCoupon}
            loading={validating}
            disabled={!couponCode.trim() || validating}
          >
            Apply
          </Button>
        </InlineStack>

        {validating && (
          <InlineStack align="center">
            <Spinner size="small" />
            <Text tone="subdued">Validating coupon...</Text>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

export default CouponInput;