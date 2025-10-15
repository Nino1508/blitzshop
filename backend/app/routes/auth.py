# app/routes/auth.py — BlitzShop (estable, sin ejecución a import)
import logging
from time import perf_counter
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from sqlalchemy import func  # para lower()

from app import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

# -----------------------------
# Helpers (sin side-effects)
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


def serialize_user_public(u: User):
    full_name = (
        u.get_full_name()
        if hasattr(u, "get_full_name")
        else f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip()
    )
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
    }


# -----------------------------
# Endpoints (todo dentro de funciones)
# -----------------------------

@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new user"""
    t0 = perf_counter()
    logger.info("[auth.register.start]")
    try:
        data = request.get_json() or {}

        for field in ("email", "password", "first_name", "last_name"):
            if not data.get(field):
                dt = (perf_counter() - t0) * 1000
                logger.info("[auth.register.ok] status=400 ms=%.2f missing=%s", dt, field)
                return error_response(400, f"{field} is required")

        email = (data.get("email") or "").lower().strip()
        username = (data.get("username") or None)
        if username is not None:
            username = username.strip()

        # Unique email (case-insensitive)
        if User.query.filter(func.lower(User.email) == email.lower()).first():
            dt = (perf_counter() - t0) * 1000
            logger.info("[auth.register.ok] status=400 ms=%.2f reason=email_exists", dt)
            return error_response(400, "Email already registered")

        # Unique username if provided (case-insensitive)
        if username:
            if User.query.filter(func.lower(User.username) == username.lower()).first():
                dt = (perf_counter() - t0) * 1000
                logger.info("[auth.register.ok] status=400 ms=%.2f reason=username_taken", dt)
                return error_response(400, "Username already taken")

        # Crear usuario
        # Si tu modelo NO hashea en __init__, usa set_password:
        #   user = User(email=email, first_name=..., last_name=..., username=username, is_admin=bool(data.get("is_admin", False)))
        #   user.set_password(data["password"])
        user = User(
            email=email,
            password=data["password"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            username=username,
            is_admin=bool(data.get("is_admin", False)),
        )

        db.session.add(user)
        db.session.commit()

        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        resp = {
            "message": "User registered successfully",
            "user": serialize_user_public(user),
            "access_token": access_token,
            "refresh_token": refresh_token,
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[auth.register.ok] status=201 ms=%.2f user_id=%s", dt, user.id)
        return jsonify(resp), 201

    except Exception as e:
        db.session.rollback()
        dt = (perf_counter() - t0) * 1000
        logger.exception("[auth.register.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Registration error", str(e))


@auth_bp.route("/login", methods=["POST"])
def login():
    """Login user"""
    t0 = perf_counter()
    logger.info("[auth.login.start]")
    try:
        data = request.get_json() or {}
        if not data.get("email") or not data.get("password"):
            return error_response(400, "Email and password are required")

        email = (data.get("email") or "").lower().strip()
        user = User.query.filter(func.lower(User.email) == email.lower()).first()

        if not user or not user.check_password(data["password"]):
            dt = (perf_counter() - t0) * 1000
            logger.info("[auth.login.ok] status=401 ms=%.2f reason=invalid_credentials", dt)
            return error_response(401, "Invalid email or password")

        if not getattr(user, "is_active", True):
            dt = (perf_counter() - t0) * 1000
            logger.info("[auth.login.ok] status=401 ms=%.2f reason=deactivated", dt)
            return error_response(401, "Account is deactivated")

        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        resp = {
            "message": "Login successful",
            "user": serialize_user_public(user),
            "access_token": access_token,
            "refresh_token": refresh_token,
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[auth.login.ok] status=200 ms=%.2f user_id=%s", dt, user.id)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[auth.login.error] ms=%.2f err=%s", dt, str(e))
        return error_response(500, "Login error", str(e))


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    """Get current user profile"""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[auth.profile.get.start] user_id=%s", user_id)
    try:
        user = User.query.get(user_id)
        if not user:
            dt = (perf_counter() - t0) * 1000
            logger.info("[auth.profile.get.ok] user_id=%s status=404 ms=%.2f", user_id, dt)
            return error_response(404, "User not found")

        resp = {"user": serialize_user_public(user)}

        dt = (perf_counter() - t0) * 1000
        logger.info("[auth.profile.get.ok] user_id=%s status=200 ms=%.2f", user_id, dt)
        return jsonify(resp), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[auth.profile.get.error] user_id=%s ms=%.2f err=%s", user_id, dt, str(e))
        return error_response(500, "Internal error", str(e))


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    t0 = perf_counter()
    uid = get_jwt_identity()
    logger.info("[auth.refresh.start] user_id=%s", uid)
    try:
        new_token = create_access_token(identity=uid)

        dt = (perf_counter() - t0) * 1000
        logger.info("[auth.refresh.ok] user_id=%s status=200 ms=%.2f", uid, dt)
        return jsonify({"access_token": new_token}), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[auth.refresh.error] user_id=%s ms=%.2f err=%s", uid, dt, str(e))
        return error_response(500, "Token refresh error", str(e))
