# users.py – BlitzShop (mejoras + contrato legacy en /users/orders)
import logging
from time import perf_counter
from decimal import Decimal, InvalidOperation
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.user import User
from app.models.order import Order, OrderItem

users_bp = Blueprint("users", __name__)
logger = logging.getLogger(__name__)

# -----------------------------
# Helpers
# -----------------------------

def to_float(v):
    try:
        if v is None:
            return 0.0
        if isinstance(v, Decimal):
            return float(v)
        return float(v)
    except (ValueError, TypeError, InvalidOperation):
        return 0.0


def error_response(status: int, error: str, message: str | None = None):
    payload = {"error": error}
    if message:
        payload["message"] = message
    return jsonify(payload), status


def get_pagination(default_page=1, default_limit=10, max_limit=100):
    try:
        page = max(int(request.args.get("page", default_page)), 1)
    except (ValueError, TypeError):
        page = default_page
    limit_param = request.args.get("per_page", request.args.get("limit", default_limit))
    try:
        limit = max(1, min(int(limit_param), max_limit))
    except (ValueError, TypeError):
        limit = default_limit
    return page, limit


def serialize_user_public(u: User):
    full_name = u.get_full_name() if hasattr(u, "get_full_name") else f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip()
    return {
        "id": u.id,
        "email": u.email,
        "username": u.username,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "full_name": full_name,
        "is_admin": getattr(u, "is_admin", False),
        "is_active": getattr(u, "is_active", True),
        "created_at": (u.created_at.isoformat() if getattr(u, "created_at", None) else None),
        "updated_at": (u.updated_at.isoformat() if getattr(u, "updated_at", None) else None),
        "email_notifications": getattr(u, "email_notifications", True),
    }

# -----------------------------
# Perfil
# -----------------------------

@users_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    t0 = perf_counter()
    uid = get_jwt_identity()
    logger.info("[users.profile.get.start] user_id=%s", uid)
    try:
        user = User.query.get(uid)
        if not user:
            dt = (perf_counter() - t0) * 1000
            logger.info("[users.profile.get.ok] user_id=%s status=404 ms=%.2f", uid, dt)
            return error_response(404, "User not found")

        resp = serialize_user_public(user)
        dt = (perf_counter() - t0) * 1000
        logger.info("[users.profile.get.ok] user_id=%s status=200 ms=%.2f", uid, dt)
        return jsonify(resp), 200
    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[users.profile.get.error] user_id=%s ms=%.2f err=%s", uid, dt, str(e))
        return error_response(500, "Internal error", str(e))


@users_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    t0 = perf_counter()
    uid = get_jwt_identity()
    logger.info("[users.profile.update.start] user_id=%s", uid)
    try:
        user = User.query.get(uid)
        if not user:
            dt = (perf_counter() - t0) * 1000
            logger.info("[users.profile.update.ok] user_id=%s status=404 ms=%.2f", uid, dt)
            return error_response(404, "User not found")

        data = request.get_json() or {}

        if "first_name" in data:
            user.first_name = (data["first_name"] or "").strip()
        if "last_name" in data:
            user.last_name = (data["last_name"] or "").strip()

        if "username" in data:
            new_username = (data["username"] or "").strip()
            if new_username and new_username != user.username:
                existing = (
                    User.query.filter(
                        db.func.lower(User.username) == new_username.lower(),
                        User.id != uid,
                    ).first()
                )
                if existing:
                    return error_response(400, "Username already taken")
                user.username = new_username

        if "email" in data:
            new_email = (data["email"] or "").lower().strip()
            if new_email and new_email != user.email:
                existing_user = User.query.filter_by(email=new_email).first()
                if existing_user and existing_user.id != uid:
                    return error_response(400, "Email already exists")
                user.email = new_email

        db.session.commit()

        resp = {
            "message": "Profile updated successfully",
            "user": serialize_user_public(user),
        }
        dt = (perf_counter() - t0) * 1000
        logger.info("[users.profile.update.ok] user_id=%s status=200 ms=%.2f", uid, dt)
        return jsonify(resp), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[users.profile.update.error] user_id=%s ms=%.2f err=%s", uid, dt, str(e))
        return error_response(500, "Internal error", str(e))

# -----------------------------
# Órdenes del usuario (legacy shape)
# -----------------------------

@users_bp.route("/orders", methods=["GET"])
@jwt_required()
def get_user_orders():
    """Obtener historial de órdenes del usuario (formato legacy para el front)"""
    t0 = perf_counter()
    uid = get_jwt_identity()
    logger.info("[users.orders.list.start] user_id=%s", uid)
    try:
        page, limit = get_pagination(default_limit=10)

        query = Order.query.filter_by(user_id=uid).order_by(Order.created_at.desc())
        total_items = query.count()
        orders = query.offset((page - 1) * limit).limit(limit).all()

        orders_list = []
        for order in orders:
            order_items = OrderItem.query.filter_by(order_id=order.id).all()
            items_list = []
            for item in order_items:
                items_list.append({
                    "id": item.id,
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "product_image_url": item.product_image_url,
                    "quantity": item.quantity,
                    "price": to_float(getattr(item, "unit_price", 0)),       # legacy key
                    "total": to_float(getattr(item, "total_price", getattr(item, "unit_price", 0) * getattr(item, "quantity", 0))),
                })

            orders_list.append({
                "id": order.id,
                "order_number": f"ORD-{order.id:06d}",
                "status": order.status,
                "total_amount": to_float(getattr(order, "total_amount", 0)),
                "items_count": len(items_list),
                "items": items_list,
                "shipping_address": getattr(order, "shipping_address", None),
                "billing_address": getattr(order, "billing_address", None),
                "payment_method": "Stripe" if getattr(order, "stripe_payment_intent_id", None) else "Pending",
                "created_at": (order.created_at.isoformat() if getattr(order, "created_at", None) else None),
                "updated_at": (order.updated_at.isoformat() if getattr(order, "updated_at", None) else None),
            })

        total_pages = (total_items + limit - 1) // limit if limit else 1

        # LEGACY RESPONSE
        resp = {
            "orders": orders_list,
            "total": total_items,
            "pages": total_pages,
            "current_page": page,
            "per_page": limit,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[users.orders.list.ok] user_id=%s status=200 ms=%.2f page=%s limit=%s total=%s",
                    uid, dt, page, limit, total_items)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[users.orders.list.error] user_id=%s ms=%.2f err=%s", uid, dt, str(e))
        return error_response(500, "Internal error", str(e))

# -----------------------------
# Seguridad (sin cambios de contrato)
# -----------------------------

@users_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    t0 = perf_counter()
    uid = get_jwt_identity()
    logger.info("[users.password.change.start] user_id=%s", uid)
    try:
        user = User.query.get(uid)
        if not user:
            dt = (perf_counter() - t0) * 1000
            logger.info("[users.password.change.ok] user_id=%s status=404 ms=%.2f", uid, dt)
            return error_response(404, "User not found")

        data = request.get_json() or {}
        if not data.get("current_password") or not data.get("new_password"):
            return error_response(400, "Current password and new password are required")
        if not user.check_password(data["current_password"]):
            return error_response(400, "Current password is incorrect")
        if len(str(data["new_password"])) < 6:
            return error_response(400, "New password must be at least 6 characters")

        user.set_password(data["new_password"])
        db.session.commit()

        dt = (perf_counter() - t0) * 1000
        logger.info("[users.password.change.ok] user_id=%s status=200 ms=%.2f", uid, dt)
        return jsonify({"message": "Password changed successfully"}), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[users.password.change.error] user_id=%s ms=%.2f err=%s", uid, dt, str(e))
        return error_response(500, "Internal error", str(e))


@users_bp.route("/delete-account", methods=["DELETE"])
@jwt_required()
def delete_account():
    """Desactivar cuenta (evitar cascadas)"""
    t0 = perf_counter()
    uid = get_jwt_identity()
    logger.info("[users.delete.start] user_id=%s", uid)
    try:
        user = User.query.get(uid)
        if not user:
            dt = (perf_counter() - t0) * 1000
            logger.info("[users.delete.ok] user_id=%s status=404 ms=%.2f", uid, dt)
            return error_response(404, "User not found")

        data = request.get_json() or {}
        password = data.get("password")
        if not password:
            return error_response(400, "Password is required")
        if not user.check_password(password):
            return error_response(401, "Incorrect password")

        # Soft delete para no perder historial
        user.is_active = False
        db.session.commit()

        dt = (perf_counter() - t0) * 1000
        logger.info("[users.delete.ok] user_id=%s status=200 ms=%.2f", uid, dt)
        return jsonify({"message": "Account deactivated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[users.delete.error] user_id=%s ms=%.2f err=%s", uid, dt, str(e))
        return error_response(500, "Internal error", str(e))


@users_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications_settings():
    t0 = perf_counter()
    uid = get_jwt_identity()
    logger.info("[users.notifications.get.start] user_id=%s", uid)
    try:
        user = User.query.get(uid)
        if not user:
            dt = (perf_counter() - t0) * 1000
            logger.info("[users.notifications.get.ok] user_id=%s status=404 ms=%.2f", uid, dt)
            return error_response(404, "User not found")

        resp = {
            "email_notifications": getattr(user, "email_notifications", True),
            "order_updates": True,
            "promotions": False,
            "newsletter": False,
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[users.notifications.get.ok] user_id=%s status=200 ms=%.2f", uid, dt)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[users.notifications.get.error] user_id=%s ms=%.2f err=%s", uid, dt, str(e))
        return error_response(500, "Internal error", str(e))


@users_bp.route("/notifications", methods=["PUT"])
@jwt_required()
def update_notifications():
    t0 = perf_counter()
    uid = get_jwt_identity()
    logger.info("[users.notifications.update.start] user_id=%s", uid)
    try:
        user = User.query.get(uid)
        if not user:
            dt = (perf_counter() - t0) * 1000
            logger.info("[users.notifications.update.ok] user_id=%s status=404 ms=%.2f", uid, dt)
            return error_response(404, "User not found")

        data = request.get_json() or {}
        if "email_notifications" in data:
            user.email_notifications = bool(data["email_notifications"])

        db.session.commit()

        resp = {
            "message": "Notification preferences updated successfully",
            "email_notifications": getattr(user, "email_notifications", True),
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[users.notifications.update.ok] user_id=%s status=200 ms=%.2f", uid, dt)
        return jsonify(resp), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[users.notifications.update.error] user_id=%s ms=%.2f err=%s", uid, dt, str(e))
        return error_response(500, "Internal error", str(e))
