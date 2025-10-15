# products.py – BlitzShop (mejoras + contrato legacy para el front)
import logging
from time import perf_counter
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.product import Product
from app.models.user import User

products_bp = Blueprint("products", __name__)
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


def get_pagination(default_page=1, default_limit=20, max_limit=100):
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


def serialize_product(p: Product):
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": to_float(p.price),
        "discount_percentage": p.discount_percentage,
        "stock": p.stock,
        "category": p.category,
        "image_url": p.image_url,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
        "updated_at": p.updated_at.isoformat() if getattr(p, "updated_at", None) else None,
        "in_stock": (p.stock or 0) > 0,
    }


# admin_required decorator according to your standard
def admin_required(fn):
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not getattr(user, "is_admin", False):
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

# -----------------------------
# Public endpoints
# -----------------------------

@products_bp.route("/", methods=["GET"])
def get_products():
    """Get all active products with optional filtering (contrato legacy + mejoras)"""
    t0 = perf_counter()
    logger.info("[products.list.start]")
    try:
        # Compat con tu front: 'search' y 'category'
        q = request.args.get("q") or request.args.get("search")
        category = request.args.get("category")
        price = request.args.get("price")  # "min:max" | "min:" | ":max" | "99"
        in_stock = request.args.get("in_stock")
        page, per_page = get_pagination(default_limit=20)

        query = Product.query.filter_by(is_active=True)

        if category:
            query = query.filter(Product.category.ilike(f"%{category}%"))

        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(Product.name.ilike(like), Product.description.ilike(like))
            )

        if price:
            try:
                if ":" in price:
                    pmin_str, pmax_str = price.split(":", 1)
                else:
                    pmin_str, pmax_str = price, None
                if pmin_str:
                    query = query.filter(Product.price >= float(pmin_str))
                if pmax_str:
                    query = query.filter(Product.price <= float(pmax_str))
            except Exception:
                pass

        if in_stock is not None:
            flag = str(in_stock).lower()
            if flag == "true":
                query = query.filter(Product.stock > 0)
            elif flag == "false":
                query = query.filter((Product.stock == 0) | (Product.stock.is_(None)))

        query = query.order_by(Product.created_at.desc())

        total_items = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        serialized = [serialize_product(p) for p in items]

        total_pages = (total_items + per_page - 1) // per_page if per_page else 1

        # CONTRATO LEGACY para tu frontend
        resp = {
            "products": serialized,
            "pagination": {
                "page": page,
                "pages": total_pages,
                "per_page": per_page,
                "total": total_items,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[products.list.ok] status=200 ms=%.2f page=%s per_page=%s total=%s",
                    dt, page, per_page, total_items)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[products.list.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Internal error", str(e))


@products_bp.route("/<int:product_id>", methods=["GET"])
def get_product(product_id):
    """Get a single product by ID (legacy shape)"""
    t0 = perf_counter()
    logger.info("[products.get.start] id=%s", product_id)
    try:
        product = Product.query.get(product_id)
        if not product or not product.is_active:
            dt = (perf_counter() - t0) * 1000
            logger.info("[products.get.ok] id=%s status=404 ms=%.2f", product_id, dt)
            return error_response(404, "Product not found")

        resp = {"product": serialize_product(product)}
        dt = (perf_counter() - t0) * 1000
        logger.info("[products.get.ok] id=%s status=200 ms=%.2f", product_id, dt)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[products.get.error] id=%s ms=%.2f err=%s", product_id, dt, str(e))
        return error_response(500, "Internal error", str(e))


# -----------------------------
# CRUD admin (manteniendo tu comportamiento)
# -----------------------------

@products_bp.route("/", methods=["POST"])
@admin_required
def create_product():
    t0 = perf_counter()
    logger.info("[products.create.start]")
    try:
        data = request.get_json() or {}

        for field in ("name", "price"):
            if not data.get(field):
                return error_response(400, f"{field} is required")

        try:
            price_val = float(data["price"])
            if price_val < 0:
                return error_response(400, "Price must be positive")
        except (ValueError, TypeError):
            return error_response(400, "Invalid price format")

        product = Product(
            name=data["name"],
            description=data.get("description", ""),
            price=price_val,
            stock=max(0, int(data.get("stock", 0))) if data.get("stock") is not None else 0,
            category=data.get("category", ""),
            image_url=data.get("image_url", ""),
            is_active=bool(data.get("is_active", True)),
        )

        db.session.add(product)
        db.session.commit()

        resp = {
            "message": "Product created successfully",
            "product": serialize_product(product),
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[products.create.ok] status=201 ms=%.2f id=%s", dt, product.id)
        return jsonify(resp), 201

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[products.create.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Internal error", str(e))


@products_bp.route("/<int:product_id>", methods=["PUT"])
@admin_required
def update_product(product_id: int):
    t0 = perf_counter()
    logger.info("[products.update.start] id=%s", product_id)
    try:
        product = Product.query.get(product_id)
        if not product:
            dt = (perf_counter() - t0) * 1000
            logger.info("[products.update.ok] id=%s status=404 ms=%.2f", product_id, dt)
            return error_response(404, "Product not found")

        data = request.get_json() or {}

        if "name" in data:
            product.name = data["name"]
        if "description" in data:
            product.description = data["description"]
        if "price" in data:
            try:
                price_val = float(data["price"])
                if price_val < 0:
                    return error_response(400, "Price must be positive")
                product.price = price_val
            except (ValueError, TypeError):
                return error_response(400, "Invalid price format")
        if "stock" in data:
            try:
                product.stock = max(0, int(data["stock"]))
            except (ValueError, TypeError):
                return error_response(400, "Invalid stock format")
        if "category" in data:
            product.category = data["category"]
        if "image_url" in data:
            product.image_url = data["image_url"]
        if "is_active" in data:
            product.is_active = bool(data["is_active"])

        db.session.commit()

        resp = {
            "message": "Product updated successfully",
            "product": serialize_product(product),
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[products.update.ok] id=%s status=200 ms=%.2f", product_id, dt)
        return jsonify(resp), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[products.update.error] id=%s ms=%.2f err=%s", product_id, dt, str(e))
        return error_response(500, "Internal error", str(e))


@products_bp.route("/<int:product_id>", methods=["DELETE"])
@admin_required
def delete_product(product_id: int):
    """Soft delete: is_active=False (más seguro para no perder datos)"""
    t0 = perf_counter()
    logger.info("[products.delete.start] id=%s", product_id)
    try:
        product = Product.query.get(product_id)
        if not product:
            dt = (perf_counter() - t0) * 1000
            logger.info("[products.delete.ok] id=%s status=404 ms=%.2f", product_id, dt)
            return error_response(404, "Product not found")

        product.is_active = False
        db.session.commit()

        dt = (perf_counter() - t0) * 1000
        logger.info("[products.delete.ok] id=%s status=200 ms=%.2f", product_id, dt)
        return jsonify({"message": "Product deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[products.delete.error] id=%s ms=%.2f err=%s", product_id, dt, str(e))
        return error_response(500, "Internal error", str(e))


@products_bp.route("/categories", methods=["GET"])
def get_categories():
    """Get all product categories (legacy key: categories)"""
    t0 = perf_counter()
    logger.info("[products.categories.start]")
    try:
        rows = (
            db.session.query(Product.category)
            .filter(
                Product.is_active.is_(True),
                Product.category.isnot(None),
                Product.category != "",
            )
            .distinct()
            .all()
        )
        categories = sorted([r[0] for r in rows if r and r[0]])

        resp = {"categories": categories}
        dt = (perf_counter() - t0) * 1000
        logger.info("[products.categories.ok] status=200 ms=%.2f total=%s", dt, len(categories))
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[products.categories.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Internal error", str(e))
