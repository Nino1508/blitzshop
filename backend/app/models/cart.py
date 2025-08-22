from app import db
from datetime import datetime

class CartItem(db.Model):
    __tablename__ = 'cart_items'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraint to avoid duplicates
    __table_args__ = (db.UniqueConstraint('user_id', 'product_id', name='unique_user_product'),)
    
    def __init__(self, user_id, product_id, quantity=1):
        self.user_id = user_id
        self.product_id = product_id
        self.quantity = quantity
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product': self.product.to_dict() if self.product else None,
            'quantity': self.quantity,
            'unit_price': float(self.product.price) if self.product else 0,
            'total_price': float(self.quantity * self.product.price) if self.product else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def update_quantity(self, new_quantity):
        """Update cart item quantity"""
        if new_quantity <= 0:
            return False  # Item should be deleted
        self.quantity = new_quantity
        return True
    
    def get_total_price(self):
        """Get total price for this item (quantity × unit price)"""
        return self.quantity * self.product.price if self.product else 0
    
    @staticmethod
    def get_user_cart(user_id):
        """Get all cart items for a user"""
        return CartItem.query.filter_by(user_id=user_id).all()
    
    @staticmethod
    def get_cart_total(user_id):
        """Calculate total cart value for a user"""
        items = CartItem.get_user_cart(user_id)
        return sum(item.get_total_price() for item in items)
    
    def __repr__(self):
        return f'<CartItem User:{self.user_id} Product:{self.product_id}>'