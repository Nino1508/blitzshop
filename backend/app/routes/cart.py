from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.cart import CartItem
from app.models.product import Product
from app.models.user import User

cart_bp = Blueprint('cart', __name__)

@cart_bp.route('/', methods=['GET'])
@jwt_required()
def get_cart():
    """Get current user's cart items"""
    try:
        user_id = get_jwt_identity()
        
        cart_items = CartItem.query.filter_by(user_id=user_id).all()
        
        items_data = []
        total_price = 0
        
        for item in cart_items:
            product = Product.query.get(item.product_id)
            if product and product.is_active:
                item_data = {
                    'id': item.id,
                    'product_id': item.product_id,
                    'quantity': item.quantity,
                    'unit_price': float(product.price),
                    'total_price': float(product.price * item.quantity),
                    'product': {
                        'name': product.name,
                        'description': product.description,
                        'image_url': product.image_url,
                        'stock': product.stock
                    }
                }
                items_data.append(item_data)
                total_price += item_data['total_price']
        
        return jsonify({
            'cart_items': items_data,
            'total_items': sum(item.quantity for item in cart_items),
            'total_price': total_price
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/add', methods=['POST'])
@jwt_required()
def add_to_cart():
    """Add item to cart"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        product_id = data.get('product_id')
        quantity = data.get('quantity', 1)
        
        if not product_id:
            return jsonify({'error': 'product_id is required'}), 400
        
        # Validate product exists and is active
        product = Product.query.get(product_id)
        if not product or not product.is_active:
            return jsonify({'error': 'Product not found'}), 404
        
        # Check stock availability
        if product.stock < quantity:
            return jsonify({'error': 'Insufficient stock'}), 400
        
        # Check if item already in cart
        existing_cart_item = CartItem.query.filter_by(
            user_id=user_id, 
            product_id=product_id
        ).first()
        
        if existing_cart_item:
            # Update quantity
            new_quantity = existing_cart_item.quantity + quantity
            if product.stock < new_quantity:
                return jsonify({'error': 'Insufficient stock'}), 400
            
            existing_cart_item.quantity = new_quantity
        else:
            # Create new cart item
            cart_item = CartItem(
                user_id=user_id,
                product_id=product_id,
                quantity=quantity
            )
            db.session.add(cart_item)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Product added to cart successfully'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/update/<int:cart_item_id>', methods=['PUT'])
@jwt_required()
def update_cart_item(cart_item_id):
    """Update cart item quantity"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        quantity = data.get('quantity')
        if quantity is None or quantity < 0:
            return jsonify({'error': 'Valid quantity is required'}), 400
        
        cart_item = CartItem.query.filter_by(
            id=cart_item_id, 
            user_id=user_id
        ).first()
        
        if not cart_item:
            return jsonify({'error': 'Cart item not found'}), 404
        
        # Check stock if increasing quantity
        product = Product.query.get(cart_item.product_id)
        if quantity > product.stock:
            return jsonify({'error': 'Insufficient stock'}), 400
        
        if quantity == 0:
            # Remove item if quantity is 0
            db.session.delete(cart_item)
        else:
            cart_item.quantity = quantity
        
        db.session.commit()
        
        return jsonify({
            'message': 'Cart updated successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/remove/<int:cart_item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_cart(cart_item_id):
    """Remove item from cart"""
    try:
        user_id = get_jwt_identity()
        
        cart_item = CartItem.query.filter_by(
            id=cart_item_id, 
            user_id=user_id
        ).first()
        
        if not cart_item:
            return jsonify({'error': 'Cart item not found'}), 404
        
        db.session.delete(cart_item)
        db.session.commit()
        
        return jsonify({
            'message': 'Item removed from cart'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cart_bp.route('/clear', methods=['DELETE'])
@jwt_required()
def clear_cart():
    """Clear all items from cart"""
    try:
        user_id = get_jwt_identity()
        
        CartItem.query.filter_by(user_id=user_id).delete()
        db.session.commit()
        
        return jsonify({
            'message': 'Cart cleared successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500