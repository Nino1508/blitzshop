# backend/app/routes/orders.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import desc, and_
from app import db
from app.models.user import User
from app.models.product import Product
from app.models.cart import CartItem
from app.models.order import Order, OrderItem
from time import perf_counter
from decimal import Decimal, InvalidOperation
import logging
from datetime import datetime

orders_bp = Blueprint('orders', __name__)
logger = logging.getLogger(__name__)

# ----------------------
# Helpers
# ----------------------
def to_float(v):
    try:
        if v is None:
            return 0.0
        if isinstance(v, Decimal):
            return float(v)
        return float(v)
    except (ValueError, TypeError, InvalidOperation):
        return 0.0

def admin_required(fn):
    """Decorador simple y consistente con analytics.py."""
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not getattr(user, "is_admin", False):
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

# ----------------------
# Endpoints
# ----------------------

@orders_bp.route('/create', methods=['POST'])
@jwt_required()
def create_order():
    """Crear una orden desde el carrito del usuario."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[orders.create.start] user_id=%s", user_id)
    try:
        data = request.get_json(silent=True) or {}

        # 1) Obtener items de carrito
        cart_items = CartItem.query.filter_by(user_id=user_id).all()
        print(f"CART_ITEMS: {len(cart_items)}")
        
        if not cart_items:
            logger.info("[orders.create.error] user_id=%s empty_cart", user_id)
            return jsonify({"error": "Cart is empty"}), 400

        # 2) Validar stock y calcular total con Decimal
        total_amount = Decimal("0")
        order_items_data = []

        for ci in cart_items:
            product = Product.query.get(ci.product_id)
            if not product or not getattr(product, "is_active", True):
                return jsonify({"error": f"Product not available (id={ci.product_id})"}), 400

            if product.stock < ci.quantity:
                return jsonify({"error": f"Insufficient stock for {product.name}"}), 400

            unit_price = product.price if isinstance(product.price, Decimal) else Decimal(str(product.price))
            line_total = unit_price * ci.quantity
            total_amount += line_total

            order_items_data.append({
                "product_id": product.id,
                "product_name": product.name,
                "product_image_url": getattr(product, "image_url", None),
                "unit_price": unit_price,
                "quantity": ci.quantity,
            })

        # 3) Crear Order
        order = Order(
            user_id=user_id,
            total_amount=total_amount,
            shipping_address=data.get("shipping_address"),
            billing_address=data.get("billing_address"),
        )
        db.session.add(order)
        db.session.flush()  # asegura order.id

        # 4) Crear OrderItems
        for item in order_items_data:
            oi = OrderItem(
                order_id=order.id,
                product_id=item["product_id"],
                product_name=item["product_name"],
                product_image_url=item["product_image_url"],
                unit_price=item["unit_price"],
                quantity=item["quantity"],
            )
            db.session.add(oi)

        # 5) Descontar stock
        for ci in cart_items:
            product = Product.query.get(ci.product_id)
            product.stock -= ci.quantity

        # 6) Limpiar carrito
        CartItem.query.filter_by(user_id=user_id).delete()

        db.session.commit()

        # 7) Respuesta consistente
        payload = getattr(order, "to_dict", None)
        if callable(payload):
            body = {"message": "Order created successfully", "order": order.to_dict()}
        else:
            body = {
                "message": "Order created successfully",
                "order": {
                    "id": order.id,
                    "user_id": order.user_id,
                    "total_amount": to_float(order.total_amount),
                    "status": getattr(order, "status", "pending"),
                    "created_at": getattr(order, "created_at", None).isoformat() if getattr(order, "created_at", None) else None,
                }
            }

        dt = (perf_counter() - t0) * 1000
        logger.info("[orders.create.ok] user_id=%s order_id=%s status=201 ms=%.2f", user_id, order.id, dt)
        return jsonify(body), 201

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[orders.create.error] user_id=%s ms=%.2f err=%s", user_id, dt, str(e))
        return jsonify({"error": "Error creating order", "message": str(e)}), 500


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    """Obtener una orden específica (solo si pertenece al usuario)."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[orders.get.start] user_id=%s order_id=%s", user_id, order_id)
    try:
        order = Order.query.filter_by(id=order_id, user_id=user_id).first()
        if not order:
            logger.info("[orders.get.not_found] user_id=%s order_id=%s", user_id, order_id)
            return jsonify({"error": "Order not found"}), 404

        payload = getattr(order, "to_dict", None)
        if callable(payload):
            body = {"order": order.to_dict()}
        else:
            body = {
                "order": {
                    "id": order.id,
                    "user_id": order.user_id,
                    "total_amount": to_float(order.total_amount),
                    "status": getattr(order, "status", "pending"),
                    "created_at": getattr(order, "created_at", None).isoformat() if getattr(order, "created_at", None) else None,
                }
            }

        dt = (perf_counter() - t0) * 1000
        logger.info("[orders.get.ok] user_id=%s order_id=%s status=200 ms=%.2f", user_id, order_id, dt)
        return jsonify(body), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[orders.get.error] user_id=%s order_id=%s ms=%.2f err=%s", user_id, dt, str(e))
        return jsonify({"error": "Error fetching order", "message": str(e)}), 500


@orders_bp.route('/my', methods=['GET'])
@jwt_required()
def list_my_orders():
    """Listar órdenes del usuario autenticado (paginado)."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    page = max(1, int(request.args.get("page", 1)))
    limit = min(50, max(1, int(request.args.get("limit", 10))))
    logger.info("[orders.my.start] user_id=%s page=%s limit=%s", user_id, page, limit)
    try:
        qs = Order.query.filter_by(user_id=user_id).order_by(desc(Order.created_at))
        total_items = qs.count()
        items = qs.offset((page - 1) * limit).limit(limit).all()

        def serialize(o: Order):
            return {
                "id": o.id,
                "total_amount": to_float(o.total_amount),
                "status": getattr(o, "status", "pending"),
                "created_at": getattr(o, "created_at", None).isoformat() if getattr(o, "created_at", None) else None,
                "items_count": len(getattr(o, "items", []) or []),
            }

        resp = {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": (total_items + limit - 1) // limit,
            "items": [serialize(o) for o in items],
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[orders.my.ok] user_id=%s status=200 count=%s ms=%.2f", user_id, len(items), dt)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[orders.my.error] user_id=%s ms=%.2f err=%s", user_id, dt, str(e))
        return jsonify({"error": "Error listing orders", "message": str(e)}), 500


@orders_bp.route('/admin/all', methods=['GET'])
@admin_required
def admin_list_orders():
    """Listado admin de todas las órdenes (paginado + filtros básicos)."""
    t0 = perf_counter()
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(1, int(request.args.get("limit", 20))))
    status = request.args.get("status")  # ej: paid, pending, cancelled
    start_date = request.args.get("start_date")  # YYYY-MM-DD
    end_date = request.args.get("end_date")      # YYYY-MM-DD
    logger.info("[orders.admin_list.start] page=%s limit=%s status=%s range=%s..%s",
                page, limit, status, start_date, end_date)
    try:
        qs = Order.query

        if status:
            qs = qs.filter(Order.status == status)

        # Filtro por rango de fechas en created_at (opcional)
        if start_date:
            try:
                sd = datetime.strptime(start_date, "%Y-%m-%d").date()
                qs = qs.filter(and_(Order.created_at >= sd))
            except ValueError:
                return jsonify({"error": "Invalid start_date format. Use YYYY-MM-DD."}), 400
        if end_date:
            try:
                ed = datetime.strptime(end_date, "%Y-%m-%d").date()
                qs = qs.filter(and_(Order.created_at <= ed))
            except ValueError:
                return jsonify({"error": "Invalid end_date format. Use YYYY-MM-DD."}), 400

        qs = qs.order_by(desc(Order.created_at))
        total_items = qs.count()
        rows = qs.offset((page - 1) * limit).limit(limit).all()

        def serialize_admin(o: Order):
            u = User.query.get(o.user_id) if o.user_id else None
            return {
                "id": o.id,
                "user_id": o.user_id,
                "email": u.email if u else None,  # ← CORREGIDO: ahora email consistente
                "total_amount": to_float(o.total_amount),
                "status": getattr(o, "status", "pending"),
                "created_at": getattr(o, "created_at", None).isoformat() if getattr(o, "created_at", None) else None,
            }

        resp = {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": (total_items + limit - 1) // limit,
            "items": [serialize_admin(o) for o in rows],
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[orders.admin_list.ok] status=200 count=%s ms=%.2f", len(rows), dt)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[orders.admin_list.error] ms=%.2f err=%s", dt, str(e))
        return jsonify({"error": "Error listing orders", "message": str(e)}), 500
