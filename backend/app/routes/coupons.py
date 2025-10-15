# backend/app/routes/coupons.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.coupon import Coupon, CouponUsage
from app.models.user import User
from app.routes.admin import admin_required
from datetime import datetime, timezone
from sqlalchemy import or_, and_
from decimal import Decimal
import logging

coupons_bp = Blueprint('coupons', __name__)
logger = logging.getLogger(__name__)

# -------- sanitization helpers --------
def _to_decimal(val):
    if val in (None, '', 'null'):
        return None
    try:
        return Decimal(str(val))
    except Exception:
        raise ValueError(f"Invalid decimal: {val}")

def _to_int(val):
    if val in (None, '', 'null'):
        return None
    try:
        return int(val)
    except Exception:
        raise ValueError(f"Invalid integer: {val}")

def _to_bool(val, default=False):
    if isinstance(val, bool):
        return val
    if val in (None, '', 'null'):
        return default
    if isinstance(val, str):
        return val.lower() in ('1', 'true', 'yes', 'on')
    return bool(val)

def _parse_iso(dt_str):
    if dt_str in (None, '', 'null'):
        return None
    # soporta ...Z
    return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))

# ==================== PUBLIC ENDPOINTS ====================

@coupons_bp.route('/validate', methods=['POST'])
@jwt_required()
def validate_coupon():
    """Validate a coupon code for current user"""
    try:
        data = request.get_json() or {}
        code = (data.get('code') or '').strip().upper()
        cart_total = float(data.get('cart_total') or data.get('orderTotal') or 0)

        if not code:
            return jsonify({'error': 'Coupon code is required'}), 400

        coupon = Coupon.query.filter_by(code=code).first()
        if not coupon:
            return jsonify({'error': 'Invalid coupon code'}), 404

        user_id = get_jwt_identity()

        is_valid, message = coupon.is_valid(cart_total=cart_total, user_id=user_id)
        if not is_valid:
            return jsonify({'error': message}), 400

        discount = coupon.calculate_discount(cart_total)

        return jsonify({
            'valid': True,
            'coupon': {
                'code': coupon.code,
                'description': coupon.description,
                'discount_type': coupon.discount_type,
                'discount_value': float(coupon.discount_value),
                'discount_amount': discount,
                'final_total': round(cart_total - discount, 2),
            }
        }), 200

    except Exception as e:
        logger.exception(f"Error validating coupon: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@coupons_bp.route('/apply', methods=['POST'])
@jwt_required()
def apply_coupon():
    """Apply a coupon to an order (called during checkout)"""
    try:
        data = request.get_json() or {}
        code = (data.get('code') or '').strip().upper()
        order_id = data.get('order_id') or data.get('orderId')
        cart_total = float(data.get('cart_total') or data.get('orderTotal') or 0)

        if not code or not order_id:
            return jsonify({'error': 'Coupon code and order ID are required'}), 400

        coupon = Coupon.query.filter_by(code=code).first()
        if not coupon:
            return jsonify({'error': 'Invalid coupon code'}), 404

        user_id = get_jwt_identity()

        is_valid, message = coupon.is_valid(cart_total=cart_total, user_id=user_id)
        if not is_valid:
            return jsonify({'error': message}), 400

        existing_usage = CouponUsage.query.filter_by(
            order_id=order_id, coupon_id=coupon.id
        ).first()
        if existing_usage:
            return jsonify({'error': 'Coupon already applied to this order'}), 400

        discount = coupon.calculate_discount(cart_total)

        usage = CouponUsage(
            coupon_id=coupon.id,
            user_id=user_id,
            order_id=order_id,
            discount_applied=Decimal(str(discount))
        )

        coupon.usage_count += 1

        db.session.add(usage)
        db.session.commit()

        logger.info(f"Coupon {code} applied to order {order_id} by user {user_id}")

        return jsonify({
            'success': True,
            'discount_applied': discount,
            'final_total': round(cart_total - discount, 2)
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error applying coupon: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ==================== ADMIN ENDPOINTS ====================

@coupons_bp.route('', methods=['GET'])
@jwt_required()
@admin_required
def get_coupons():
    """Get all coupons with filtering and pagination"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', 'all')  # all, active, expired, inactive

        query = Coupon.query

        if search:
            like = f'%{search}%'
            query = query.filter(or_(Coupon.code.ilike(like), Coupon.description.ilike(like)))

        now = datetime.now(timezone.utc)
        if status == 'active':
            query = query.filter(
                and_(
                    Coupon.is_active.is_(True),
                    or_(Coupon.valid_from.is_(None), Coupon.valid_from <= now),
                    or_(Coupon.valid_until.is_(None), Coupon.valid_until >= now),
                )
            )
        elif status == 'expired':
            query = query.filter(Coupon.valid_until.isnot(None), Coupon.valid_until < now)
        elif status == 'inactive':
            query = query.filter(Coupon.is_active.is_(False))

        query = query.order_by(Coupon.created_at.desc())

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'coupons': [c.to_dict() for c in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        logger.exception(f"Error fetching coupons: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@coupons_bp.route('', methods=['POST'])
@jwt_required()
@admin_required
def create_coupon():
    """Create a new coupon (sanitiza payload)"""
    try:
        data = request.get_json() or {}

        code = (data.get('code') or '').strip().upper()
        if not code:
            return jsonify({'error': 'Coupon code is required'}), 400

        if Coupon.query.filter_by(code=code).first():
            return jsonify({'error': 'Coupon code already exists'}), 400

        coupon = Coupon(
            code=code,
            description=(data.get('description') or '').strip(),
            discount_type=(data.get('discount_type') or 'percentage').strip(),
            discount_value=_to_decimal(data.get('discount_value')) or Decimal('0'),
            min_purchase=_to_decimal(data.get('min_purchase')),
            max_discount=_to_decimal(data.get('max_discount')),
            usage_limit=_to_int(data.get('usage_limit')) or 0,
            usage_limit_per_user=_to_int(data.get('usage_limit_per_user')) or 1,
            valid_from=_parse_iso(data.get('valid_from')) or datetime.now(timezone.utc),
            valid_until=_parse_iso(data.get('valid_until')),
            is_active=_to_bool(data.get('is_active'), True),
        )

        db.session.add(coupon)
        db.session.commit()

        logger.info(f"Coupon {code} created by admin")
        return jsonify({'message': 'Coupon created successfully', 'coupon': coupon.to_dict()}), 201

    except (ValueError, TypeError) as e:
        db.session.rollback()
        return jsonify({'error': f'Invalid payload: {e}'}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error creating coupon: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@coupons_bp.route('/<int:coupon_id>', methods=['PUT', 'PATCH'])
@jwt_required()
@admin_required
def update_coupon(coupon_id):
    """Update an existing coupon (sanitiza payload)"""
    try:
        coupon = Coupon.query.get_or_404(coupon_id)
        data = request.get_json() or {}

        if 'code' in data:
            new_code = (data.get('code') or '').strip().upper()
            if not new_code:
                return jsonify({'error': 'Coupon code cannot be empty'}), 400
            if new_code != coupon.code and Coupon.query.filter_by(code=new_code).first():
                return jsonify({'error': 'Coupon code already exists'}), 400
            coupon.code = new_code

        if 'description' in data:
            coupon.description = (data.get('description') or '').strip()

        if 'discount_type' in data:
            coupon.discount_type = (data.get('discount_type') or 'percentage').strip()

        if 'discount_value' in data:
            coupon.discount_value = _to_decimal(data.get('discount_value')) or Decimal('0')

        if 'min_purchase' in data:
            coupon.min_purchase = _to_decimal(data.get('min_purchase'))

        if 'max_discount' in data:
            coupon.max_discount = _to_decimal(data.get('max_discount'))

        if 'usage_limit' in data:
            coupon.usage_limit = _to_int(data.get('usage_limit')) or 0

        if 'usage_limit_per_user' in data:
            coupon.usage_limit_per_user = _to_int(data.get('usage_limit_per_user')) or 0

        if 'is_active' in data:
            coupon.is_active = _to_bool(data.get('is_active'), coupon.is_active)

        if 'valid_from' in data:
            coupon.valid_from = _parse_iso(data.get('valid_from')) or coupon.valid_from

        if 'valid_until' in data:
            coupon.valid_until = _parse_iso(data.get('valid_until'))

        coupon.updated_at = datetime.now(timezone.utc)
        db.session.commit()

        logger.info(f"Coupon {coupon.code} updated by admin")
        return jsonify({'message': 'Coupon updated successfully', 'coupon': coupon.to_dict()}), 200

    except (ValueError, TypeError) as e:
        db.session.rollback()
        return jsonify({'error': f'Invalid payload: {e}'}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error updating coupon: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@coupons_bp.route('/<int:coupon_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_coupon(coupon_id):
    """Delete a coupon (soft delete if has usage)"""
    try:
        coupon = Coupon.query.get_or_404(coupon_id)

        if (coupon.usage_count or 0) > 0:
            coupon.is_active = False
            db.session.commit()
            return jsonify({'message': 'Coupon deactivated (has usage history)'}), 200

        db.session.delete(coupon)
        db.session.commit()
        return jsonify({'message': 'Coupon deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error deleting coupon: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@coupons_bp.route('/<int:coupon_id>/usage', methods=['GET'])
@jwt_required()
@admin_required
def get_coupon_usage(coupon_id):
    """Get usage history for a specific coupon"""
    try:
        coupon = Coupon.query.get_or_404(coupon_id)

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)

        usage_query = CouponUsage.query.filter_by(coupon_id=coupon_id).order_by(CouponUsage.used_at.desc())
        paginated = usage_query.paginate(page=page, per_page=per_page, error_out=False)

        usage_list = [{
            'id': u.id,
            'user_id': u.user_id,
            'user_email': u.user.email if u.user else None,
            'order_id': u.order_id,
            'discount_applied': float(u.discount_applied),
            'used_at': u.used_at.isoformat() if u.used_at else None
        } for u in paginated.items]

        return jsonify({
            'coupon': coupon.to_dict(),
            'usage': usage_list,
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        logger.exception(f"Error fetching coupon usage: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@coupons_bp.route('/stats', methods=['GET'])
@jwt_required()
@admin_required
def get_coupon_stats():
    """Get overall coupon statistics"""
    try:
        total_coupons = Coupon.query.count()
        active_coupons = Coupon.query.filter_by(is_active=True).count()

        total_usage = db.session.query(db.func.sum(Coupon.usage_count)).scalar() or 0
        total_discount = db.session.query(db.func.sum(CouponUsage.discount_applied)).scalar() or 0

        most_used = Coupon.query.filter(Coupon.usage_count > 0).order_by(Coupon.usage_count.desc()).limit(5).all()

        return jsonify({
            'total_coupons': total_coupons,
            'active_coupons': active_coupons,
            'total_usage': int(total_usage) if total_usage is not None else 0,
            'total_discount_given': float(total_discount) if total_discount is not None else 0.0,
            'most_used_coupons': [{
                'code': c.code,
                'usage_count': c.usage_count,
                'discount_type': c.discount_type,
                'discount_value': float(c.discount_value)
            } for c in most_used]
        }), 200

    except Exception as e:
        logger.exception(f"Error fetching coupon stats: {e}")
        return jsonify({'error': 'Internal server error'}), 500