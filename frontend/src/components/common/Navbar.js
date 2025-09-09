import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Badge, Text } from '@shopify/polaris';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { getTotalItems } = useCart();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleProfile = () => {
    navigate('/profile');
  };

  const handleCart = () => {
    navigate('/cart');
  };

  const handleLogo = () => {
    navigate('/');
  };

  if (isMobile) {
    // MOBILE LAYOUT - 2 ROWS
    return (
      <div style={{ 
        backgroundColor: '#f6f6f7', 
        borderBottom: '1px solid #e1e3e5',
        padding: '12px 20px'
      }}>
        {/* Row 1: Logo + Navigation Links - CENTERED */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '12px'
        }}>
          <div 
            style={{ 
              cursor: 'pointer', 
              fontWeight: 'bold',
              fontSize: '18px'
            }}
            onClick={handleLogo}
          >
            🛒⚡ BlitzShop
          </div>
          
          <Link 
            to="/products" 
            style={{ 
              textDecoration: 'none', 
              color: '#202223',
              fontWeight: '500',
              padding: '4px 8px'
            }}
          >
            Products
          </Link>
          
          {isAuthenticated() && user?.is_admin && (
            <Link 
              to="/admin" 
              style={{ 
                textDecoration: 'none', 
                color: '#202223',
                fontWeight: '500',
                backgroundColor: '#e3f2fd',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Row 2: Cart + Auth - CENTERED */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{ position: 'relative' }}>
            <Button size="slim" onClick={handleCart}>
              🛒 Cart
            </Button>
            {getTotalItems() > 0 && (
              <div style={{ 
                position: 'absolute', 
                top: '-8px', 
                right: '-8px',
                zIndex: 1
              }}>
                <Badge size="small">{getTotalItems()}</Badge>
              </div>
            )}
          </div>

          {isAuthenticated() ? (
            <>
              <Text variant="bodyMd" as="span">
                Hi, {user?.username}!
              </Text>
              <Button size="slim" onClick={handleProfile}>
                Profile
              </Button>
              <Button size="slim" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button size="slim" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button size="slim" primary onClick={() => navigate('/register')}>
                Register
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // DESKTOP LAYOUT - 1 ROW
  return (
    <div style={{ 
      backgroundColor: '#f6f6f7', 
      borderBottom: '1px solid #e1e3e5',
      padding: '12px 20px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        
        {/* Left: Logo + Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div 
            style={{ 
              cursor: 'pointer', 
              fontWeight: 'bold',
              fontSize: '18px'
            }}
            onClick={handleLogo}
          >
            🛒⚡ BlitzShop
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <Link 
              to="/products" 
              style={{ 
                textDecoration: 'none', 
                color: '#202223',
                fontWeight: '500',
                padding: '4px 8px'
              }}
            >
              Products
            </Link>
            
            {isAuthenticated() && user?.is_admin && (
              <Link 
                to="/admin" 
                style={{ 
                  textDecoration: 'none', 
                  color: '#202223',
                  fontWeight: '500',
                  backgroundColor: '#e3f2fd',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* Right: Cart + Auth Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ position: 'relative' }}>
            <Button size="slim" onClick={handleCart}>
              🛒 Cart
            </Button>
            {getTotalItems() > 0 && (
              <div style={{ 
                position: 'absolute', 
                top: '-8px', 
                right: '-8px',
                zIndex: 1
              }}>
                <Badge size="small">{getTotalItems()}</Badge>
              </div>
            )}
          </div>

          {isAuthenticated() ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Text variant="bodyMd" as="span">
                Hi, {user?.username}!
              </Text>
              <Button size="slim" onClick={handleProfile}>
                Profile
              </Button>
              <Button size="slim" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              <Button size="slim" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button size="slim" primary onClick={() => navigate('/register')}>
                Register
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Navbar;