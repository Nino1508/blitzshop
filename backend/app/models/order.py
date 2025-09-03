from app import db
from datetime import datetime

class Order(db.Model):
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(50), default='pending')  # pending, paid, shipped, delivered, cancelled
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    coupon_code = db.Column(db.String(50))
    discount_amount = db.Column(db.Numeric(10, 2), default=0)
    final_amount = db.Column(db.Numeric(10, 2))
    stripe_payment_intent_id = db.Column(db.String(200))
    shipping_address = db.Column(db.Text)
    billing_address = db.Column(db.Text)  # Para Stripe
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    # ⚠️ Importante: NO definimos user aquí, ya viene del backref en User.orders

    def __init__(self, user_id, total_amount, shipping_address=None, billing_address=None):
        self.user_id = user_id
        self.total_amount = total_amount
        self.shipping_address = shipping_address
        self.billing_address = billing_address
    
    def to_dict(self):
        # Construye objeto customer usando el backref order.user
        customer = None
        if hasattr(self, 'user') and self.user:
            display_name = getattr(self.user, 'full_name', None) or getattr(self.user, 'username', None)
            if not display_name and getattr(self.user, 'email', None):
                display_name = self.user.email.split('@')[0]
            customer = {
                'id': self.user.id,
                'display_name': display_name,
                'email': self.user.email
            }

        return {
            'id': self.id,
            'user_id': self.user_id,
            'status': self.status,
            'total_amount': float(self.total_amount),
            'coupon_code': self.coupon_code,
            'discount_amount': float(self.discount_amount) if self.discount_amount else 0,
            'final_amount': float(self.final_amount) if self.final_amount else float(self.total_amount),
            'stripe_payment_intent_id': self.stripe_payment_intent_id,
            'shipping_address': self.shipping_address,
            'billing_address': self.billing_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'customer': customer,  # ← aquí ya solucionamos lo de "N/A" en frontend
            'items': [item.to_dict() for item in self.items]
        }
    
    def calculate_total(self):
        """Calculate total based on items"""
        total = sum(item.quantity * item.unit_price for item in self.items)
        self.total_amount = total
        return total
    
    def __repr__(self):
        return f'<Order {self.id}>'


class OrderItem(db.Model):
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    
    # Snapshot del producto al momento de compra
    product_name = db.Column(db.String(100), nullable=False)
    product_image_url = db.Column(db.String(255))
    
    def __init__(self, order_id, product_id, quantity, unit_price, product_name, product_image_url=None):
        self.order_id = order_id
        self.product_id = product_id
        self.quantity = quantity
        self.unit_price = unit_price
        self.product_name = product_name
        self.product_image_url = product_image_url
    
    @property
    def total_price(self):
        return self.quantity * self.unit_price
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'product_image_url': self.product_image_url,
            'quantity': self.quantity,
            'unit_price': float(self.unit_price),
            'total_price': float(self.total_price)
        }
    
    def __repr__(self):
        return f'<OrderItem {self.id}>'