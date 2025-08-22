import stripe
import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.order import Order

load_dotenv()

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
payments_bp = Blueprint('payments', __name__)

@payments_bp.route('/create-intent', methods=['POST'])
@jwt_required()
def create_payment_intent():
    """Crear Stripe Payment Intent"""
    print("=== ENTRANDO A CREATE_PAYMENT_INTENT ===")
    try:
        user_id = get_jwt_identity()
        print(f"USER_ID: {user_id}")
        data = request.get_json()
        print(f"DATA: {data}")
        order_id = data.get('order_id')
        print(f"ORDER_ID: {order_id}")
        
        if not order_id:
            print("ERROR: No order_id provided")
            return jsonify({'error': 'order_id is required'}), 400
        
        # Verificar que la orden pertenezca al usuario
        order = Order.query.filter_by(id=order_id, user_id=user_id).first()
        print(f"ORDER FOUND: {order}")
        if not order:
            print("ERROR: Order not found")
            return jsonify({'error': 'Order not found'}), 404
        
        if order.status != 'pending':
            print(f"ERROR: Order status is {order.status}, not pending")
            return jsonify({'error': 'Order cannot be paid'}), 400
        
        # Convertir a centavos para Stripe
        amount_cents = int(float(order.total_amount) * 100)
        print(f"AMOUNT_CENTS: {amount_cents}")
        
        # Crear Payment Intent
        print("CREANDO PAYMENT INTENT EN STRIPE...")
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            metadata={
                'order_id': order_id,
                'user_id': user_id
            }
        )
        print(f"PAYMENT INTENT CREADO: {intent.id}")
        
        # Guardar payment_intent_id en la orden
        order.stripe_payment_intent_id = intent.id
        db.session.commit()
        print("PAYMENT INTENT ID GUARDADO EN ORDEN")
        
        return jsonify({
            'client_secret': intent.client_secret,
            'payment_intent_id': intent.id
        }), 200
        
    except stripe.error.StripeError as e:
        print(f"STRIPE ERROR: {str(e)}")
        return jsonify({'error': 'Stripe error', 'message': str(e)}), 400
    except Exception as e:
        print(f"ERROR GENERAL: {str(e)}")
        return jsonify({'error': 'Error creating payment intent', 'message': str(e)}), 500

@payments_bp.route('/confirm', methods=['POST'])
@jwt_required()
def confirm_payment():
    """Confirmar pago exitoso"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        payment_intent_id = data.get('payment_intent_id')
        
        if not payment_intent_id:
            return jsonify({'error': 'payment_intent_id is required'}), 400
        
        # Buscar orden por payment_intent_id
        order = Order.query.filter_by(
            stripe_payment_intent_id=payment_intent_id,
            user_id=user_id
        ).first()
        
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Verificar el estado en Stripe
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status == 'succeeded':
            order.status = 'paid'
            db.session.commit()
            
            return jsonify({
                'message': 'Payment confirmed successfully',
                'order': order.to_dict()
            }), 200
        else:
            return jsonify({'error': 'Payment not completed'}), 400
            
    except stripe.error.StripeError as e:
        return jsonify({'error': 'Stripe error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Error confirming payment', 'message': str(e)}), 500