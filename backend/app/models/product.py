from app import db
from datetime import datetime, timezone

class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    category = db.Column(db.String(100))
    image_url = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    discount_percentage = db.Column(db.Integer, default=0)  # NUEVO CAMPO
    shopify_product_id = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))  # ARREGLADO
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))  # ARREGLADO
    
    # Relationships
    order_items = db.relationship('OrderItem', backref='product', lazy=True)
    cart_items = db.relationship('CartItem', backref='product', lazy=True)
    
    def __init__(self, name, price, description=None, stock=0, category=None, image_url=None, is_active=True, discount_percentage=0):
        self.name = name.strip()
        self.price = price
        self.description = description
        self.stock = stock
        self.category = category
        self.image_url = image_url
        self.is_active = is_active
        self.discount_percentage = discount_percentage  # ADDED TO CONSTRUCTOR
    
    # Propiedad para compatibilidad con stock_quantity
    @property
    def stock_quantity(self):
        return self.stock
    
    @stock_quantity.setter
    def stock_quantity(self, value):
        self.stock = value
    
    def to_dict(self):
        # Calcular precio con descuento si aplica
        sale_price = None
        if self.discount_percentage > 0:
            sale_price = float(self.price) * (1 - self.discount_percentage / 100)
            
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': float(self.price),
            'sale_price': round(sale_price, 2) if sale_price else None,  # ADDED
            'discount_percentage': self.discount_percentage,  # ADDED
            'stock': self.stock,
            'stock_quantity': self.stock,
            'category': self.category,
            'image_url': self.image_url,
            'is_active': self.is_active,
            'shopify_product_id': self.shopify_product_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def update_stock(self, quantity):
        """Update product stock"""
        self.stock += quantity
        if self.stock < 0:
            self.stock = 0
    
    def is_available(self, quantity=1):
        """Check if stock is available"""
        return self.is_active and self.stock >= quantity
    
    def __repr__(self):
        return f'<Product {self.name}>'