# payments.py – BlitzShop (refactor consistente)
import os
import logging
from time import perf_counter
from decimal import Decimal, InvalidOperation

import stripe
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.order import Order

load_dotenv()

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

payments_bp = Blueprint("payments", __name__)
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


def _set_order_status(order: Order, new_status: str):
    """Transición segura de estado."""
    # Estados esperados: pending -> paid | cancelled
    if new_status not in ("pending", "paid", "cancelled"):
        return
    order.status = new_status
    db.session.commit()


# -----------------------------
# Endpoints
# -----------------------------

@payments_bp.route("/create-intent", methods=["POST"])
@jwt_required()
def create_payment_intent():
    """Crear Stripe Payment Intent para una orden del usuario."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[payments.intent.start] user_id=%s", user_id)
    try:
        data = request.get_json() or {}
        order_id = data.get("order_id")
        if not order_id:
            return error_response(400, "order_id is required")

        # Verificar que la orden pertenezca al usuario
        order = Order.query.filter_by(id=order_id, user_id=user_id).first()
        if not order:
            dt = (perf_counter() - t0) * 1000
            logger.info("[payments.intent.ok] user_id=%s order_id=%s status=404 ms=%.2f",
                        user_id, order_id, dt)
            return error_response(404, "Order not found")

        if order.status != "pending":
            return error_response(400, "Order cannot be paid")

        # Convertir a centavos para Stripe
        amount_cents = int(round(to_float(order.total_amount) * 100))

        # Crear Payment Intent (no loguear client_secret)
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            metadata={
                "order_id": str(order.id),
                "user_id": str(user_id),
            },
        )

        # Guardar payment_intent_id en la orden
        order.stripe_payment_intent_id = intent.id
        db.session.commit()

        resp = {
            "payment_intent_id": intent.id,
            "client_secret": intent.client_secret,  # Se retorna al frontend; no log
            "amount": to_float(order.total_amount),
            "currency": "usd",
            "order_id": order.id,
            "status": order.status,  # pending
        }

        dt = (perf_counter() - t0) * 1000
        logger.info("[payments.intent.ok] user_id=%s order_id=%s status=200 ms=%.2f",
                    user_id, order.id, dt)
        return jsonify(resp), 200

    except stripe.error.StripeError as e:
        dt = (perf_counter() - t0) * 1000
        logger.warning("[payments.intent.error] user_id=%s ms=%.2f stripe_err=%s",
                       user_id, dt, str(e))
        return error_response(400, "Stripe error", str(e))
    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[payments.intent.error] user_id=%s ms=%.2f err=%s",
                         user_id, dt, str(e))
        return error_response(500, "Error creating payment intent", str(e))


@payments_bp.route("/confirm", methods=["POST"])
@jwt_required()
def confirm_payment():
    """Confirmar pago desde el cliente (verifica en Stripe y actualiza estado)."""
    t0 = perf_counter()
    user_id = get_jwt_identity()
    logger.info("[payments.confirm.start] user_id=%s", user_id)
    try:
        data = request.get_json() or {}
        payment_intent_id = data.get("payment_intent_id")
        if not payment_intent_id:
            return error_response(400, "payment_intent_id is required")

        # Buscar orden por payment_intent_id (y pertenencia)
        order = Order.query.filter_by(
            stripe_payment_intent_id=payment_intent_id,
            user_id=user_id,
        ).first()
        if not order:
            dt = (perf_counter() - t0) * 1000
            logger.info("[payments.confirm.ok] user_id=%s status=404 ms=%.2f pi=%s",
                        user_id, dt, payment_intent_id)
            return error_response(404, "Order not found")

        # Consultar estado real en Stripe
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)

        # Update local state according to Stripe
        if intent.status == "succeeded":
            _set_order_status(order, "paid")
        elif intent.status in ("canceled", "requires_payment_method"):
            _set_order_status(order, "cancelled")
        else:
            # sigue pendiente / en proceso
            _set_order_status(order, "pending")

        resp = {
            "message": "Payment confirmed successfully" if order.status == "paid" else "Payment not completed",
            "order": order.to_dict() if hasattr(order, "to_dict") else {
                "id": order.id,
                "status": order.status,
                "total_amount": to_float(order.total_amount),
                "payment_intent_id": order.stripe_payment_intent_id,
            },
        }

        status_code = 200 if order.status == "paid" else 400
        dt = (perf_counter() - t0) * 1000
        logger.info("[payments.confirm.ok] user_id=%s order_id=%s status=%s http=%s ms=%.2f",
                    user_id, order.id, order.status, status_code, dt)
        return jsonify(resp), status_code

    except stripe.error.StripeError as e:
        dt = (perf_counter() - t0) * 1000
        logger.warning("[payments.confirm.error] user_id=%s ms=%.2f stripe_err=%s",
                       user_id, dt, str(e))
        return error_response(400, "Stripe error", str(e))
    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[payments.confirm.error] user_id=%s ms=%.2f err=%s",
                         user_id, dt, str(e))
        return error_response(500, "Error confirming payment", str(e))


@payments_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    """
    Webhook Stripe (opcional pero recomendado).
    Actualiza la orden según el evento oficial de Stripe.
    """
    t0 = perf_counter()
    logger.info("[payments.webhook.start]")
    try:
        payload = request.data
        sig_header = request.headers.get("Stripe-Signature")

        if not STRIPE_WEBHOOK_SECRET:
            # If not configured, we cannot verify signature
            logger.warning("[payments.webhook.error] missing_webhook_secret")
            return error_response(500, "Webhook not configured")

        try:
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=sig_header,
                secret=STRIPE_WEBHOOK_SECRET,
            )
        except ValueError as e:
            logger.warning("[payments.webhook.error] invalid_payload err=%s", str(e))
            return error_response(400, "Invalid payload", str(e))
        except stripe.error.SignatureVerificationError as e:
            logger.warning("[payments.webhook.error] signature_verification_failed err=%s", str(e))
            return error_response(400, "Invalid signature", str(e))

        # Manejar eventos relevantes
        if event["type"] in ("payment_intent.succeeded", "payment_intent.canceled", "payment_intent.payment_failed"):
            intent = event["data"]["object"]
            pi_id = intent.get("id")
            metadata = intent.get("metadata", {}) or {}
            order_id = metadata.get("order_id")

            # Buscar orden por metadata o por pi id como fallback
            order = None
            if order_id:
                order = Order.query.filter_by(id=int(order_id)).first()
            if not order and pi_id:
                order = Order.query.filter_by(stripe_payment_intent_id=pi_id).first()

            if order:
                if event["type"] == "payment_intent.succeeded":
                    _set_order_status(order, "paid")
                    logger.info("[payments.webhook.ok] event=succeeded order_id=%s", order.id)
                elif event["type"] in ("payment_intent.canceled", "payment_intent.payment_failed"):
                    _set_order_status(order, "cancelled")
                    logger.info("[payments.webhook.ok] event=%s order_id=%s", event["type"], order.id)
            else:
                logger.warning("[payments.webhook.warn] order_not_found pi=%s order_id=%s", pi_id, order_id)

        dt = (perf_counter() - t0) * 1000
        logger.info("[payments.webhook.ok] status=200 ms=%.2f type=%s", dt, event["type"])
        # Stripe expects 2xx without specific body
        return jsonify({"ok": True}), 200

    except Exception as e:
        dt = (perf_counter() - t0) * 1000
        logger.exception("[payments.webhook.error] ms=%.2f err=%s", dt, str(e))
        # Important: respond 2xx only if Stripe should retry; here we return 500 for retry
        return error_response(500, "Webhook processing error", str(e))
