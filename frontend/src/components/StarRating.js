import React from 'react';
import { Icon } from '@shopify/polaris';
import { StarFilledIcon, StarIcon } from '@shopify/polaris-icons';

/**
 * Componente de estrellas reutilizable
 * Puede ser interactivo (para seleccionar rating) o solo lectura (para mostrar rating)
 */
const StarRating = ({ 
  rating = 0, 
  onRatingChange, 
  size = 'medium',
  readonly = false 
}) => {
  const [hoverRating, setHoverRating] = React.useState(0);
  
  const totalStars = 5;
  const isInteractive = !readonly && onRatingChange;
  
  // Tamaños en pixels
  const sizes = {
    small: 16,
    medium: 20,
    large: 24
  };
  
  const iconSize = sizes[size] || sizes.medium;
  
  const handleClick = (selectedRating) => {
    if (isInteractive) {
      onRatingChange(selectedRating);
    }
  };
  
  const handleMouseEnter = (star) => {
    if (isInteractive) {
      setHoverRating(star);
    }
  };
  
  const handleMouseLeave = () => {
    if (isInteractive) {
      setHoverRating(0);
    }
  };
  
  const displayRating = hoverRating || rating;
  
  return (
    <div 
      style={{ 
        display: 'flex', 
        gap: '4px',
        alignItems: 'center',
        cursor: isInteractive ? 'pointer' : 'default'
      }}
      onMouseLeave={handleMouseLeave}
    >
      {[...Array(totalStars)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= displayRating;
        
        return (
          <div
            key={index}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => handleMouseEnter(starValue)}
            style={{
              display: 'inline-flex',
              transition: 'transform 0.1s ease',
              transform: isInteractive && hoverRating === starValue ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            <Icon 
              source={isFilled ? StarFilledIcon : StarIcon}
              tone={isFilled ? 'warning' : 'subdued'}
            />
          </div>
        );
      })}
      
      {readonly && rating > 0 && (
        <span style={{ 
          marginLeft: '8px', 
          fontSize: '14px',
          color: '#6B7280'
        }}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default StarRating;
