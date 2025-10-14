from datetime import datetime, timezone
from app import db

class Review(db.Model):
    """Modelo para reviews y ratings de productos"""
    __tablename__ = 'reviews'
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    
    rating = db.Column(db.Integer, nullable=False)  # 1-5 estrellas
    title = db.Column(db.String(200))
    comment = db.Column(db.Text)
    
    is_verified_purchase = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    product = db.relationship('Product', backref=db.backref('reviews', lazy='dynamic', cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('reviews', lazy='dynamic'))
    order = db.relationship('Order', backref=db.backref('reviews', lazy='dynamic'))
    
    def to_dict(self):
        """Convertir review a diccionario"""
        return {
            'id': self.id,
            'product_id': self.product_id,
            'user_id': self.user_id,
            'order_id': self.order_id,
            'rating': self.rating,
            'title': self.title,
            'comment': self.comment,
            'is_verified_purchase': self.is_verified_purchase,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'user_name': self.user.username if self.user else None,
            'user_email': self.user.email if self.user else None
        }
    
    def __repr__(self):
        return f'<Review {self.id} - Product {self.product_id} - Rating {self.rating}>'
