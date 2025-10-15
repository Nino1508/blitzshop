import React, { useState, useEffect } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Divider,
  Badge,
  EmptyState,
  Spinner,
  Banner
} from '@shopify/polaris';
import StarRating from './StarRating';
import ReviewForm from './ReviewForm';
import api from '../services/api';

const ReviewSection = ({ productId }) => {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [userReview, setUserReview] = useState(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('ecommerce-jwt-token');
  const isLoggedIn = !!token;

  useEffect(() => {
    fetchReviews();
    if (isLoggedIn) {
      checkCanReview();
    }
  }, [productId, isLoggedIn]);

  const fetchReviews = async () => {
    try {
      const response = await api.get(`/api/products/${productId}/reviews`);
      setReviews(response.data.reviews || []);
      setStats({
        averageRating: response.data.average_rating || 0,
        totalReviews: response.data.total_reviews || 0
      });
      
      // Check if user already left a review
      if (isLoggedIn) {
        const userReviewInList = response.data.reviews.find(
          r => r.user_id === getCurrentUserId()
        );
        if (userReviewInList) {
          setUserReview(userReviewInList);
        }
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Error loading reviews');
    } finally {
      setLoading(false);
    }
  };

  const checkCanReview = async () => {
    try {
      const response = await api.get(`/api/products/${productId}/reviews/can-review`);
      setCanReview(response.data.can_review);
      if (response.data.existing_review) {
        setUserReview(response.data.existing_review);
      }
    } catch (err) {
      console.error('Error checking review eligibility:', err);
    }
  };

  const getCurrentUserId = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub;
    } catch {
      return null;
    }
  };

  const handleReviewSuccess = (newReview) => {
    setShowForm(false);
    setUserReview(newReview);
    setCanReview(false);
    fetchReviews(); // Recargar todas las reviews
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete your review?')) {
      return;
    }

    try {
      await api.delete(`/api/reviews/${reviewId}`);
      setUserReview(null);
      setCanReview(true);
      fetchReviews();
    } catch (err) {
      console.error('Error deleting review:', err);
      alert('Error deleting review. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner size="large" />
        </div>
      </Card>
    );
  }

  return (
    <BlockStack gap="400">
      {/* Header con stats */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <div>
              <Text variant="headingLg" as="h2">
                Customer Reviews
              </Text>
              <div style={{ marginTop: '8px' }}>
                <InlineStack gap="200" blockAlign="center">
                  <StarRating rating={stats.averageRating} readonly />
                  <Text variant="bodyMd" tone="subdued">
                    Based on {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
                  </Text>
                </InlineStack>
              </div>
            </div>

            {isLoggedIn && canReview && !showForm && (
              <Button primary onClick={() => setShowForm(true)}>
                Write a Review
              </Button>
            )}

            {!isLoggedIn && (
              <Text variant="bodyMd" tone="subdued">
                Log in to write a review
              </Text>
            )}
          </InlineStack>

          {error && (
            <Banner tone="critical" onDismiss={() => setError('')}>
              {error}
            </Banner>
          )}
        </BlockStack>
      </Card>

      {/* User's own review */}
      {userReview && !showForm && (
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="start">
              <Text variant="headingMd" as="h3">
                Your Review
              </Text>
              <InlineStack gap="200">
                <Button size="slim" onClick={() => setShowForm(true)}>
                  Edit
                </Button>
                <Button 
                  size="slim" 
                  tone="critical"
                  onClick={() => handleDeleteReview(userReview.id)}
                >
                  Delete
                </Button>
              </InlineStack>
            </InlineStack>

            <InlineStack gap="200" blockAlign="center">
              <StarRating rating={userReview.rating} readonly size="small" />
              {userReview.is_verified_purchase && (
                <Badge tone="success">Verified Purchase</Badge>
              )}
            </InlineStack>

            {userReview.title && (
              <Text variant="headingSm" as="h4">
                {userReview.title}
              </Text>
            )}

            <Text variant="bodyMd">
              {userReview.comment}
            </Text>

            <Text variant="bodySm" tone="subdued">
              Reviewed on {formatDate(userReview.created_at)}
            </Text>
          </BlockStack>
        </Card>
      )}

      {/* Review Form */}
      {showForm && (
        <ReviewForm
          productId={productId}
          existingReview={userReview}
          onSuccess={handleReviewSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card>
          <EmptyState
            heading="No reviews yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Be the first to review this product!</p>
          </EmptyState>
        </Card>
      ) : (
        <BlockStack gap="300">
          {reviews.filter(r => r.id !== userReview?.id).map((review, index) => (
            <React.Fragment key={review.id}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="start">
                    <div>
                      <Text variant="bodyMd" fontWeight="semibold">
                        {review.user_name || 'Anonymous'}
                      </Text>
                      <div style={{ marginTop: '4px' }}>
                        <InlineStack gap="200" blockAlign="center">
                          <StarRating rating={review.rating} readonly size="small" />
                          {review.is_verified_purchase && (
                            <Badge tone="success">Verified Purchase</Badge>
                          )}
                        </InlineStack>
                      </div>
                    </div>
                    <Text variant="bodySm" tone="subdued">
                      {formatDate(review.created_at)}
                    </Text>
                  </InlineStack>

                  {review.title && (
                    <Text variant="headingSm" as="h4">
                      {review.title}
                    </Text>
                  )}

                  <Text variant="bodyMd">
                    {review.comment}
                  </Text>
                </BlockStack>
              </Card>
              {index < reviews.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
};

export default ReviewSection;
