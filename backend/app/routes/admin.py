# app/routes/admin.py — BlitzShop (compat admin + mejoras)
import os
import uuid
import logging
from time import perf_counter
from decimal import Decimal, InvalidOperation
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app import db
from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderItem  # items para /orders

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")
logger = logging.getLogger(__name__)

# --- Uploads (igual que tu versión original) ---
UPLOAD_FOLDER = "static/uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Helpers estándar ---
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

def admin_required(f):
    @jwt_required()
    def decorated(*args, **kwargs):
        uid = get_jwt_identity()
        user = User.query.get(uid)
        if not user or not getattr(user, "is_admin", False):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated

# =========================
# Productos (ADMIN)
# =========================

@admin_bp.route("/products", methods=["GET"])
@admin_required
def get_all_products():
    """Listado admin con contrato legacy: products + pagination"""
    t0 = perf_counter()
    logger.info("[admin.products.list.start]")
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        search = request.args.get("search", "", type=str)
        category = request.args.get("category", "", type=str)

        query = Product.query
        if search:
            query = query.filter(Product.name.contains(search))
        if category:
            query = query.filter(Product.category == category)

        query = query.order_by(Product.id.desc())
        products = query.paginate(page=page, per_page=per_page, error_out=False)

        items = [{
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": to_float(p.price),
            "category": p.category,
            "image_url": p.image_url,
            "stock_quantity": p.stock,   # clave legacy
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        } for p in products.items]

        resp = {
            "products": items,
            "pagination": {
                "page": products.page,
                "pages": products.pages,
                "per_page": products.per_page,
                "total": products.total,
                "has_next": products.has_next,
                "has_prev": products.has_prev,
            },
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[admin.products.list.ok] status=200 ms=%.2f page=%s per_page=%s total=%s",
                    dt, products.page, products.per_page, products.total)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[admin.products.list.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Error fetching products", str(e))

@admin_bp.route("/products", methods=["POST"])
@admin_required
def create_product():
    """Crear producto (form-data o JSON) — contrato legacy en respuesta"""
    t0 = perf_counter()
    logger.info("[admin.products.create.start]")
    try:
        use_form = bool(request.files) or bool(request.form)
        if use_form:
            name = request.form.get("name")
            description = request.form.get("description")
            price = request.form.get("price")
            category = request.form.get("category")
            stock_quantity = request.form.get("stock_quantity", 0)
            is_active = request.form.get("is_active", "true").lower() == "true"
            image_file = request.files.get("image")
        else:
            data = request.get_json() or {}
            name = data.get("name")
            description = data.get("description")
            price = data.get("price")
            category = data.get("category")
            stock_quantity = data.get("stock_quantity", 0)
            is_active = bool(data.get("is_active", True))
            image_file = None

        if not name or not price or not category:
            return error_response(400, "Name, price and category are required")

        try:
            price = float(price)
            stock_quantity = int(stock_quantity)
        except (ValueError, TypeError):
            return error_response(400, "Invalid price or stock quantity")

        if price < 0 or stock_quantity < 0:
            return error_response(400, "Price and stock cannot be negative")

        if Product.query.filter_by(name=name).first():
            return error_response(400, "Product with this name already exists")

        image_url = None
        if image_file and image_file.filename:
            if not allowed_file(image_file.filename):
                return error_response(400, "Invalid image format. Use PNG, JPG, JPEG, GIF or WEBP")
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            filename = secure_filename(image_file.filename)
            unique = f"{uuid.uuid4()}_{filename}"
            filepath = os.path.join(UPLOAD_FOLDER, unique)
            image_file.save(filepath)
            # Absoluto como tu versión original
            image_url = f"http://localhost:5000/static/uploads/{unique}"

        product = Product(
            name=name,
            price=price,
            description=description or "",
            stock=stock_quantity,
            category=category,
            image_url=image_url,
            is_active=is_active,
        )
        db.session.add(product)
        db.session.commit()

        resp = {
            "message": "Product created successfully",
            "product": {
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "price": to_float(product.price),
                "category": product.category,
                "image_url": product.image_url,
                "stock_quantity": product.stock,
                "is_active": product.is_active,
            },
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[admin.products.create.ok] status=201 ms=%.2f id=%s", dt, product.id)
        return jsonify(resp), 201

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[admin.products.create.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Error creating product", str(e))

@admin_bp.route("/products/<int:product_id>", methods=["PUT"])
@admin_required
def update_product(product_id):
    """Actualizar producto (form-data o JSON) — contrato legacy"""
    t0 = perf_counter()
    logger.info("[admin.products.update.start] id=%s", product_id)
    try:
        product = Product.query.get(product_id)
        if not product:
            dt = (perf_counter() - t0) * 1000
            logger.info("[admin.products.update.ok] id=%s status=404 ms=%.2f", product_id, dt)
            return error_response(404, "Product not found")

        use_form = bool(request.files) or bool(request.form)
        if use_form:
            name = request.form.get("name")
            description = request.form.get("description")
            price = request.form.get("price")
            category = request.form.get("category")
            stock_quantity = request.form.get("stock_quantity")
            is_active_raw = request.form.get("is_active")
            image_file = request.files.get("image")
            is_active = (str(is_active_raw).lower() == "true") if is_active_raw is not None else None
        else:
            data = request.get_json() or {}
            name = data.get("name")
            description = data.get("description")
            price = data.get("price")
            category = data.get("category")
            stock_quantity = data.get("stock_quantity")
            is_active = data.get("is_active")
            image_file = None

        if name is not None:
            if not name.strip():
                return error_response(400, "Name cannot be empty")
            existing = Product.query.filter(Product.name == name, Product.id != product_id).first()
            if existing:
                return error_response(400, "Product with this name already exists")
            product.name = name

        if description is not None:
            product.description = description

        if price is not None:
            try:
                price = float(price)
                if price < 0:
                    return error_response(400, "Price cannot be negative")
                product.price = price
            except (ValueError, TypeError):
                return error_response(400, "Invalid price format")

        if category is not None:
            if not category.strip():
                return error_response(400, "Category cannot be empty")
            product.category = category

        if stock_quantity is not None:
            try:
                stock_val = int(stock_quantity)
                if stock_val < 0:
                    return error_response(400, "Stock cannot be negative")
                product.stock = stock_val
            except (ValueError, TypeError):
                return error_response(400, "Invalid stock quantity format")

        if is_active is not None:
            product.is_active = bool(is_active)

        if image_file and image_file.filename:
            if not allowed_file(image_file.filename):
                return error_response(400, "Invalid image format")
            # borrar anterior si era local
            if product.image_url and "localhost:5000" in product.image_url:
                old_filename = product.image_url.split("/")[-1]
                old_path = os.path.join(UPLOAD_FOLDER, old_filename)
                if os.path.exists(old_path):
                    try:
                        os.remove(old_path)
                    except Exception:
                        pass
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            filename = secure_filename(image_file.filename)
            unique = f"{uuid.uuid4()}_{filename}"
            filepath = os.path.join(UPLOAD_FOLDER, unique)
            image_file.save(filepath)
            product.image_url = f"http://localhost:5000/static/uploads/{unique}"

        db.session.commit()

        resp = {
            "message": "Product updated successfully",
            "product": {
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "price": to_float(product.price),
                "category": product.category,
                "image_url": product.image_url,
                "stock_quantity": product.stock,
                "is_active": product.is_active,
            },
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[admin.products.update.ok] id=%s status=200 ms=%.2f", product_id, dt)
        return jsonify(resp), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[admin.products.update.error] id=%s ms=%.2f err=%s", product_id, dt, str(e))
        return error_response(500, "Error updating product", str(e))

@admin_bp.route("/products/<int:product_id>", methods=["DELETE"])
@admin_required
def delete_product(product_id):
    """Eliminar producto permanentemente (legacy comportamiento)"""
    t0 = perf_counter()
    logger.info("[admin.products.delete.start] id=%s", product_id)
    try:
        product = Product.query.get(product_id)
        if not product:
            dt = (perf_counter() - t0) * 1000
            logger.info("[admin.products.delete.ok] id=%s status=404 ms=%.2f", product_id, dt)
            return error_response(404, "Product not found")

        # eliminar imagen si es local
        if product.image_url and "localhost:5000" in product.image_url:
            old_filename = product.image_url.split("/")[-1]
            old_path = os.path.join(UPLOAD_FOLDER, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception:
                    pass

        db.session.delete(product)
        db.session.commit()

        dt = (perf_counter() - t0) * 1000
        logger.info("[admin.products.delete.ok] id=%s status=200 ms=%.2f", product_id, dt)
        return jsonify({"message": "Product deleted permanently"}), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[admin.products.delete.error] id=%s ms=%.2f err=%s", product_id, dt, str(e))
        return error_response(500, "Error deleting product", str(e))

@admin_bp.route("/products/<int:product_id>/toggle-status", methods=["PATCH"])
@admin_required
def toggle_product_status(product_id):
    """Activar/desactivar producto"""
    t0 = perf_counter()
    logger.info("[admin.products.toggle_status.start] id=%s", product_id)
    try:
        product = Product.query.get(product_id)
        if not product:
            dt = (perf_counter() - t0) * 1000
            logger.info("[admin.products.toggle_status.ok] id=%s status=404 ms=%.2f", product_id, dt)
            return error_response(404, "Product not found")

        product.is_active = not product.is_active
        db.session.commit()

        resp = {"message": f"Product {'activated' if product.is_active else 'deactivated'} successfully",
                "is_active": product.is_active}

        dt = (perf_counter() - t0) * 1000
        logger.info("[admin.products.toggle_status.ok] id=%s status=200 ms=%.2f", product_id, dt)
        return jsonify(resp), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[admin.products.toggle_status.error] id=%s ms=%.2f err=%s", product_id, dt, str(e))
        return error_response(500, "Error toggling product status", str(e))

@admin_bp.route("/categories", methods=["GET"])
@admin_required
def get_categories():
    """Contrato legacy: {'categories':[...]}"""
    t0 = perf_counter()
    logger.info("[admin.categories.start]")
    try:
        rows = db.session.query(Product.category).distinct().all()
        categories = [c[0] for c in rows if c and c[0]]
        resp = {"categories": sorted(categories)}
        dt = (perf_counter() - t0) * 1000
        logger.info("[admin.categories.ok] status=200 ms=%.2f total=%s", dt, len(categories))
        return jsonify(resp), 200
    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[admin.categories.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Error fetching categories", str(e))

# =========================
# Órdenes (ADMIN)
# =========================

@admin_bp.route("/orders", methods=["GET"])
@admin_required
def get_all_orders():
    """Listado admin de órdenes — contrato legacy: orders + total/pages/current_page"""
    t0 = perf_counter()
    logger.info("[admin.orders.list.start]")
    try:
        status = request.args.get("status")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        # join con usuario para extraer su email si lo necesitas
        query = Order.query
        if status and status != "all":
            query = query.filter(Order.status == status)

        query = query.order_by(Order.created_at.desc())
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        orders_list = []
        for order in paginated.items:
            order_items = OrderItem.query.filter_by(order_id=order.id).all()
            orders_list.append({
                "id": order.id,
                "user_id": order.user_id,
                "total_amount": to_float(order.total_amount),
                "status": order.status,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "updated_at": order.updated_at.isoformat() if order.updated_at else None,
                "shipping_address": order.shipping_address,
                "billing_address": order.billing_address,
                "items": [{
                    "id": item.id,
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "unit_price": to_float(item.unit_price),
                    "total_price": to_float(getattr(item, "total_price", item.unit_price * item.quantity)),
                } for item in order_items],
            })

        resp = {
            "orders": orders_list,
            "total": paginated.total,
            "pages": paginated.pages,
            "current_page": page,
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[admin.orders.list.ok] status=200 ms=%.2f page=%s per_page=%s total=%s",
                    dt, page, per_page, paginated.total)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[admin.orders.list.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Error fetching orders", str(e))

@admin_bp.route("/orders/<int:order_id>/status", methods=["PUT"])
@admin_required
def update_order_status(order_id):
    """Actualizar estado de orden — contrato legacy simple"""
    t0 = perf_counter()
    logger.info("[admin.orders.status.start] order_id=%s", order_id)
    try:
        order = Order.query.get(order_id)
        if not order:
            dt = (perf_counter() - t0) * 1000
            logger.info("[admin.orders.status.ok] order_id=%s status=404 ms=%.2f", order_id, dt)
            return error_response(404, "Order not found")

        data = request.get_json() or {}
        valid = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"]
        new_status = data.get("status")
        if new_status not in valid:
            return error_response(400, "Invalid status")

        order.status = new_status
        order.updated_at = datetime.utcnow()
        db.session.commit()

        resp = {"message": "Order status updated", "order_id": order_id, "new_status": new_status}

        dt = (perf_counter() - t0) * 1000
        logger.info("[admin.orders.status.ok] order_id=%s status=200 ms=%.2f", order_id, dt)
        return jsonify(resp), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[admin.orders.status.error] order_id=%s ms=%.2f err=%s", order_id, dt, str(e))
        return error_response(500, "Error updating order status", str(e))
