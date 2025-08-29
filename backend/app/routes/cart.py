# cart.py – BlitzShop (mejoras + contrato legacy del carrito)
import logging
from time import perf_counter
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.cart import CartItem
from app.models.product import Product

cart_bp = Blueprint("cart", __name__)
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


def _serialize_cart(user_id: int):
    """Nuevo formato interno: items + total."""
    cart_items = CartItem.query.filter_by(user_id=user_id).all()

    items = []
    total = 0.0

    for ci in cart_items:
        product = Product.query.get(ci.product_id)
        if not product or not getattr(product, "is_active", True):
            continue

        unit_price = to_float(getattr(product, "price", 0))
        quantity = int(getattr(ci, "quantity", 0) or 0)
        line_total = unit_price * quantity

        items.append({
            "product_id": product.id,
            "name": getattr(product, "name", None),
            "unit_price": unit_price,
            "quantity": quantity,
            "line_total": round(line_total, 2),
        })
        total += line_total

    return {"items": items, "total": round(total, 2)}


def _legacy_cart(resp):
    """Adaptación al contrato legacy del front."""
    legacy_items = []
    for i in resp.get("items", []):
        legacy_items.append({
            "id": None,
            "product_id": i["product_id"],
            "quantity": i["quantity"],
            "unit_price": i["unit_price"],
            "total_price": i["line_total"],
            "product": {
                "name": i.get("name"),
                "description": None,
                "image_url": None,
                "stock": None
            }
        })
    return {
        "cart_items": legacy_items,
        "total_items": sum(i["quantity"] for i in resp.get("items", [])),
        "total_price": resp.get("total", 0.0)
    }

# -----------------------------
# Endpoints
# -----------------------------

@cart_bp.route("/", methods=["GET"])
@jwt_required()
def get_cart():
    """Get current user's cart items (legacy response)."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[cart.get.start] user_id=%s", user_id)
    try:
        resp = _serialize_cart(user_id)
        legacy = _legacy_cart(resp)
        dt = (perf_counter() - t0) * 1000
        logger.info("[cart.get.ok] user_id=%s status=200 ms=%.2f items=%s total=%.2f",
                    user_id, dt, len(resp["items"]), resp["total"])
        return jsonify(legacy), 200
    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[cart.get.error] user_id=%s ms=%.2f err=%s", user_id, dt, str(e))
        return error_response(500, "Internal error", str(e))


@cart_bp.route("/add", methods=["POST"])
@jwt_required()
def add_to_cart():
    """Add item to cart (valida stock) con respuesta legacy."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[cart.add.start] user_id=%s", user_id)
    try:
        data = request.get_json() or {}
        product_id = data.get("product_id")
        quantity = data.get("quantity", 1)

        if not product_id:
            return error_response(400, "product_id is required")
        try:
            quantity = int(quantity)
        except (ValueError, TypeError):
            return error_response(400, "Valid quantity is required")
        if quantity <= 0:
            return error_response(400, "Quantity must be positive")

        product = Product.query.get(product_id)
        if not product or not getattr(product, "is_active", True):
            return error_response(404, "Product not found")

        if product.stock is None or product.stock < quantity:
            return error_response(400, "Insufficient stock")

        ci = CartItem.query.filter_by(user_id=user_id, product_id=product_id).first()
        if ci:
            new_qty = ci.quantity + quantity
            if product.stock < new_qty:
                return error_response(400, "Insufficient stock")
            ci.quantity = new_qty
        else:
            ci = CartItem(user_id=user_id, product_id=product_id, quantity=quantity)
            db.session.add(ci)

        db.session.commit()

        resp = _serialize_cart(user_id)
        legacy = _legacy_cart(resp)
        dt = (perf_counter() - t0) * 1000
        logger.info("[cart.add.ok] user_id=%s status=201 ms=%.2f product_id=%s qty=%s",
                    user_id, dt, product_id, quantity)
        return jsonify(legacy), 201

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[cart.add.error] user_id=%s ms=%.2f err=%s", user_id, dt, str(e))
        return error_response(500, "Internal error", str(e))


@cart_bp.route("/update/<int:cart_item_id>", methods=["PUT"])
@jwt_required()
def update_cart_item(cart_item_id: int):
    """Update cart item quantity (0 elimina) con respuesta legacy."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[cart.update.start] user_id=%s cart_item_id=%s", user_id, cart_item_id)
    try:
        data = request.get_json() or {}
        quantity = data.get("quantity")

        try:
            quantity = int(quantity)
        except (ValueError, TypeError):
            return error_response(400, "Valid quantity is required")
        if quantity < 0:
            return error_response(400, "Valid quantity is required")

        ci = CartItem.query.filter_by(id=cart_item_id, user_id=user_id).first()
        if not ci:
            dt = (perf_counter() - t0) * 1000
            logger.info("[cart.update.ok] user_id=%s cart_item_id=%s status=404 ms=%.2f",
                        user_id, cart_item_id, dt)
            return error_response(404, "Cart item not found")

        product = Product.query.get(ci.product_id)
        if not product or not getattr(product, "is_active", True):
            return error_response(404, "Product not found")

        if quantity == 0:
            db.session.delete(ci)
        else:
            if product.stock is None or quantity > product.stock:
                return error_response(400, "Insufficient stock")
            ci.quantity = quantity

        db.session.commit()

        resp = _serialize_cart(user_id)
        legacy = _legacy_cart(resp)
        dt = (perf_counter() - t0) * 1000
        logger.info("[cart.update.ok] user_id=%s cart_item_id=%s status=200 ms=%.2f qty=%s",
                    user_id, cart_item_id, dt, quantity)
        return jsonify(legacy), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[cart.update.error] user_id=%s cart_item_id=%s ms=%.2f err=%s",
                         user_id, cart_item_id, dt, str(e))
        return error_response(500, "Internal error", str(e))


@cart_bp.route("/remove/<int:cart_item_id>", methods=["DELETE"])
@jwt_required()
def remove_from_cart(cart_item_id: int):
    """Remove item from cart (legacy response)."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[cart.remove.start] user_id=%s cart_item_id=%s", user_id, cart_item_id)
    try:
        ci = CartItem.query.filter_by(id=cart_item_id, user_id=user_id).first()
        if not ci:
            dt = (perf_counter() - t0) * 1000
            logger.info("[cart.remove.ok] user_id=%s cart_item_id=%s status=404 ms=%.2f",
                        user_id, cart_item_id, dt)
            return error_response(404, "Cart item not found")

        db.session.delete(ci)
        db.session.commit()

        resp = _serialize_cart(user_id)
        legacy = _legacy_cart(resp)
        dt = (perf_counter() - t0) * 1000
        logger.info("[cart.remove.ok] user_id=%s cart_item_id=%s status=200 ms=%.2f",
                    user_id, cart_item_id, dt)
        return jsonify(legacy), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[cart.remove.error] user_id=%s cart_item_id=%s ms=%.2f err=%s",
                         user_id, cart_item_id, dt, str(e))
        return error_response(500, "Internal error", str(e))


@cart_bp.route("/clear", methods=["DELETE"])
@jwt_required()
def clear_cart():
    """Clear all items from cart (legacy response)."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[cart.clear.start] user_id=%s", user_id)
    try:
        CartItem.query.filter_by(user_id=user_id).delete()
        db.session.commit()

        resp = _serialize_cart(user_id)
        legacy = _legacy_cart(resp)
        dt = (perf_counter() - t0) * 1000
        logger.info("[cart.clear.ok] user_id=%s status=200 ms=%.2f", user_id, dt)
        return jsonify(legacy), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[cart.clear.error] user_id=%s ms=%.2f err=%s", user_id, dt, str(e))
        return error_response(500, "Internal error", str(e))
