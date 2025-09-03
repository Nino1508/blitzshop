# backend/app/models/coupon.py
from app import db
from datetime import datetime
from sqlalchemy import func

class Coupon(db.Model):
    __tablename__ = 'coupons'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    description = db.Column(db.String(200), default='')

    # Discount configuration
    discount_type = db.Column(db.String(20), nullable=False)  # 'percentage' or 'fixed'
    discount_value = db.Column(db.Numeric(10, 2), nullable=False)  # ✅ Numeric, no Decimal

    # Usage limits (opcionales -> permitir NULL)
    min_purchase = db.Column(db.Numeric(10, 2), nullable=True)   # ✅ puede ser NULL
    max_discount = db.Column(db.Numeric(10, 2), nullable=True)   # ✅ cap opcional para percentage
    usage_limit = db.Column(db.Integer, nullable=True, default=0)
    usage_limit_per_user = db.Column(db.Integer, nullable=True, default=1)
    usage_count = db.Column(db.Integer, nullable=False, default=0)

    # Validity period
    valid_from = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    valid_until = db.Column(db.DateTime, nullable=True)          # ✅ puede ser NULL

    # Status
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    # Metadata
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    usage_history = db.relationship('CouponUsage', backref='coupon', lazy='dynamic')

    def is_valid(self, cart_total=None, user_id=None):
        """Check if coupon is valid for use"""
        now = datetime.utcnow()

        if not self.is_active:
            return False, "Coupon is not active"

        if self.valid_from and now < self.valid_from:
            return False, "Coupon is not yet valid"

        if self.valid_until and now > self.valid_until:
            return False, "Coupon has expired"

        if cart_total is not None and self.min_purchase is not None:
            if float(cart_total) < float(self.min_purchase):
                return False, f"Minimum purchase of €{float(self.min_purchase):.2f} required"

        if self.usage_limit is not None and self.usage_limit > 0:
            if self.usage_count >= self.usage_limit:
                return False, "Coupon usage limit reached"

        if user_id and self.usage_limit_per_user:
            user_usage = CouponUsage.query.filter_by(
                coupon_id=self.id,
                user_id=user_id
            ).count()
            if user_usage >= self.usage_limit_per_user:
                return False, "You have already used this coupon"

        return True, "Valid"

    def calculate_discount(self, cart_total):
        """Calculate discount amount for given cart total"""
        total = float(cart_total or 0)
        if self.discount_type == 'percentage':
            discount = total * (float(self.discount_value) / 100.0)
            if self.max_discount is not None:
                discount = min(discount, float(self.max_discount))
        else:  # fixed
            discount = float(self.discount_value)
            discount = min(discount, total)

        return round(discount, 2)

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'description': self.description or '',
            'discount_type': self.discount_type,
            'discount_value': float(self.discount_value) if self.discount_value is not None else 0.0,
            'min_purchase': float(self.min_purchase) if self.min_purchase is not None else None,
            'max_discount': float(self.max_discount) if self.max_discount is not None else None,
            'usage_limit': self.usage_limit,
            'usage_limit_per_user': self.usage_limit_per_user,
            'usage_count': self.usage_count,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class CouponUsage(db.Model):
    __tablename__ = 'coupon_usage'

    id = db.Column(db.Integer, primary_key=True)
    coupon_id = db.Column(db.Integer, db.ForeignKey('coupons.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    discount_applied = db.Column(db.Numeric(10, 2), nullable=False)  # ✅ Numeric, no Decimal
    used_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='coupon_usage')
    order = db.relationship('Order', backref='coupon_usage')
