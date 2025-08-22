from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.product import Product
from app.models.cart import CartItem
from app.models.order import Order, OrderItem

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('/create', methods=['POST'])
@jwt_required()
def create_order():
    """Crear una orden desde el carrito del usuario"""
    print("ENTRANDO A CREATE_ORDER")
    try:
        user_id = get_jwt_identity()
        print(f"USER_ID: {user_id}")
        data = request.get_json() or {}
        
        # Obtener items del carrito
        cart_items = CartItem.query.filter_by(user_id=user_id).all()
        print(f"CART_ITEMS: {len(cart_items)}")
        
        if not cart_items:
            return jsonify({'error': 'Cart is empty'}), 400
        
        # Validar stock y calcular total
        total_amount = 0
        order_items_data = []
        
        for cart_item in cart_items:
            product = Product.query.get(cart_item.product_id)
            
            if not product or not product.is_active:
                return jsonify({'error': f'Product not available'}), 400
            
            if product.stock < cart_item.quantity:
                return jsonify({'error': f'Insufficient stock for {product.name}'}), 400
            
            item_total = product.price * cart_item.quantity
            total_amount += item_total
            
            order_items_data.append({
                'product_id': product.id,
                'product_name': product.name,
                'product_image_url': product.image_url,
                'unit_price': product.price,
                'quantity': cart_item.quantity
            })
        
        # Crear orden
        order = Order(
            user_id=user_id,
            total_amount=total_amount,
            shipping_address=data.get('shipping_address'),
            billing_address=data.get('billing_address')
        )
        
        db.session.add(order)
        db.session.flush()
        
        # Crear order items
        for item_data in order_items_data:
            order_item = OrderItem(
                order_id=order.id,
                **item_data
            )
            db.session.add(order_item)
        
        # Actualizar stock
        for cart_item in cart_items:
            product = Product.query.get(cart_item.product_id)
            product.stock -= cart_item.quantity
        
        # Limpiar carrito
        CartItem.query.filter_by(user_id=user_id).delete()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Order created successfully',
            'order': order.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"ERROR EN CREATE_ORDER: {str(e)}")
        return jsonify({'error': 'Error creating order', 'message': str(e)}), 500

@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    """Obtener una orden específica (solo si pertenece al usuario)"""
    try:
        user_id = get_jwt_identity()
        
        # Buscar la orden Y verificar que pertenezca al usuario
        order = Order.query.filter_by(id=order_id, user_id=user_id).first()
        
        if not order:
            return jsonify({'error': 'Order not found'}), 404
            
        return jsonify({'order': order.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': 'Error fetching order', 'message': str(e)}), 500