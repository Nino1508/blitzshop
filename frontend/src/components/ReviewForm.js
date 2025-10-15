import React, { useState } from 'react';
import {
  Card,
  BlockStack,
  TextField,
  Button,
  Text,
  Banner,
  InlineStack
} from '@shopify/polaris';
import StarRating from './StarRating';
import api from '../services/api';

const ReviewForm = ({ productId, existingReview, onSuccess, onCancel }) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [title, setTitle] = useState(existingReview?.title || '');
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    // Validaciones
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (!comment.trim()) {
      setError('Please write a review');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('ecommerce-jwt-token');
      const endpoint = existingReview 
        ? `/api/reviews/${existingReview.id}`
        : `/api/products/${productId}/reviews`;
      
      const method = existingReview ? 'PUT' : 'POST';

      const response = await fetch(`${api.defaults.baseURL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rating,
          title: title.trim(),
          comment: comment.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error submitting review');
      }

      const data = await response.json();
      
      // Call success callback
      if (onSuccess) {
        onSuccess(data.review);
      }
      
      // Limpiar formulario si es nueva review
      if (!existingReview) {
        setRating(0);
        setTitle('');
        setComment('');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Error submitting review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          {existingReview ? 'Edit Your Review' : 'Write a Review'}
        </Text>

        {error && (
          <Banner tone="critical" onDismiss={() => setError('')}>
            {error}
          </Banner>
        )}

        <BlockStack gap="300">
          <div>
            <Text variant="bodyMd" as="p" fontWeight="medium">
              Rating *
            </Text>
            <div style={{ marginTop: '8px' }}>
              <StarRating 
                rating={rating} 
                onRatingChange={setRating}
                size="large"
              />
            </div>
          </div>

          <TextField
            label="Review Title (optional)"
            value={title}
            onChange={setTitle}
            placeholder="Sum up your experience..."
            maxLength={200}
            showCharacterCount
          />

          <TextField
            label="Your Review *"
            value={comment}
            onChange={setComment}
            multiline={4}
            placeholder="Share your experience with this product..."
            helpText="Tell others what you think about this product"
          />
        </BlockStack>

        <InlineStack gap="200" align="end">
          {onCancel && (
            <Button onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button 
            primary 
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={rating === 0 || !comment.trim()}
          >
            {existingReview ? 'Update Review' : 'Submit Review'}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
};

export default ReviewForm;