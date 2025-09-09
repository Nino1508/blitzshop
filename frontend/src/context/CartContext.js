import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Detectar entorno automáticamente
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://blitzshop-backend.onrender.com';

// Create context
const CartContext = createContext();

// Hook to use cart context
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

// Cart provider component
export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { getAuthToken } = useAuth();

  // Fetch cart items from backend (only when needed)
  const fetchCartItems = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/cart/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCartItems(data.cart_items || []);
      } else {
        console.error('Failed to fetch cart items');
        setCartItems([]);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Add item to cart with optimistic update
  const addToCart = async (productId, quantity = 1) => {
    const token = getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const existingItem = cartItems.find(item => item.product_id === productId);
    
    if (existingItem) {
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.product_id === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    }

    try {
      const response = await fetch(`${API_URL}/api/cart/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: productId,
          quantity: quantity
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (!existingItem) {
          await fetchCartItems();
        }
        return { success: true, message: data.message };
      } else {
        if (existingItem) {
          setCartItems(prevItems =>
            prevItems.map(item =>
              item.product_id === productId
                ? { ...item, quantity: item.quantity - quantity }
                : item
            )
          );
        }
        return { success: false, error: data.error || 'Failed to add to cart' };
      }
    } catch (error) {
      if (existingItem) {
        setCartItems(prevItems =>
          prevItems.map(item =>
            item.product_id === productId
              ? { ...item, quantity: item.quantity - quantity }
              : item
          )
        );
      }
      console.error('Error adding to cart:', error);
      return { success: false, error: 'Connection error. Please try again.' };
    }
  };

  // Update item quantity with optimistic update
  const updateCartItem = async (cartItemId, quantity) => {
    const token = getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const originalItems = [...cartItems];

    if (quantity === 0) {
      setCartItems(prevItems => prevItems.filter(item => item.id !== cartItemId));
    } else {
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.id === cartItemId
            ? { ...item, quantity: quantity, total_price: item.unit_price * quantity }
            : item
        )
      );
    }

    try {
      const response = await fetch(`${API_URL}/api/cart/update/${cartItemId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        setCartItems(originalItems);
        return { success: false, error: data.error || 'Failed to update cart' };
      }
    } catch (error) {
      setCartItems(originalItems);
      console.error('Error updating cart:', error);
      return { success: false, error: 'Connection error. Please try again.' };
    }
  };

  // Remove item from cart with optimistic update
  const removeFromCart = async (cartItemId) => {
    const token = getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const originalItems = [...cartItems];
    setCartItems(prevItems => prevItems.filter(item => item.id !== cartItemId));

    try {
      const response = await fetch(`${API_URL}/api/cart/remove/${cartItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        setCartItems(originalItems);
        return { success: false, error: data.error || 'Failed to remove from cart' };
      }
    } catch (error) {
      setCartItems(originalItems);
      console.error('Error removing from cart:', error);
      return { success: false, error: 'Connection error. Please try again.' };
    }
  };

  // Clear entire cart with optimistic update
  const clearCart = async () => {
    const token = getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const originalItems = [...cartItems];
    setCartItems([]);

    try {
      const response = await fetch(`${API_URL}/api/cart/clear`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        setCartItems(originalItems);
        return { success: false, error: data.error || 'Failed to clear cart' };
      }
    } catch (error) {
      setCartItems(originalItems);
      console.error('Error clearing cart:', error);
      return { success: false, error: 'Connection error. Please try again.' };
    }
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + item.total_price, 0);
  };

  const isInCart = (productId) => {
    return cartItems.some(item => item.product_id === productId);
  };

  const getProductQuantity = (productId) => {
    const item = cartItems.find(item => item.product_id === productId);
    return item ? item.quantity : 0;
  };

  useEffect(() => {
    if (getAuthToken()) {
      fetchCartItems();
    } else {
      setCartItems([]);
    }
  }, [getAuthToken()]);

  const value = {
    cartItems,
    loading,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getTotalItems,
    getTotalPrice,
    isInCart,
    getProductQuantity,
    fetchCartItems
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
