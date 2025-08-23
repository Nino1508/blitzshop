from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.order import Order, OrderItem  # OrderItem está en el mismo archivo
from datetime import datetime

users_bp = Blueprint('users', __name__)

@users_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Obtener perfil del usuario actual"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': user.get_full_name(),
            'is_admin': user.is_admin,
            'created_at': user.created_at.isoformat() if user.created_at else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Actualizar perfil del usuario"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        print(f"DEBUG: Datos recibidos: {data}")
        print(f"DEBUG: Username actual: {user.username}")
        
        # Actualizar campos permitidos
        if 'first_name' in data:
            user.first_name = data['first_name'].strip()
            print(f"DEBUG: First name actualizado a: {user.first_name}")
            
        if 'last_name' in data:
            user.last_name = data['last_name'].strip()
            print(f"DEBUG: Last name actualizado a: {user.last_name}")

        if 'username' in data:
            new_username = data['username'].strip()  # SIN .lower() para mantener capitalización
            print(f"DEBUG: Intentando cambiar username de '{user.username}' a '{new_username}'")
            
            # Solo verificar si el username realmente cambió
            if new_username != user.username:
                # Verificar si el nuevo username ya existe (case insensitive)
                existing = User.query.filter(
                    db.func.lower(User.username) == new_username.lower(),
                    User.id != user_id  # Excluir el usuario actual
                ).first()
                if existing:
                    print(f"DEBUG: Username '{new_username}' ya está en uso por user_id: {existing.id}")
                    return jsonify({'error': 'Username already taken'}), 400
                
                user.username = new_username
                print(f"DEBUG: Username cambiado a: {user.username}")
            else:
                print(f"DEBUG: Username no cambió, manteniendo: {user.username}")
            
        if 'email' in data:
            # Verificar que el email no esté en uso
            new_email = data['email'].lower().strip()
            existing_user = User.query.filter_by(email=new_email).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Email already exists'}), 400
            user.email = new_email
        
        print(f"DEBUG: Antes de commit - Username: {user.username}, First: {user.first_name}, Last: {user.last_name}")
        db.session.commit()
        print(f"DEBUG: Después de commit - Username: {user.username}")
        
        # Verificar que se guardó correctamente
        user_check = User.query.get(user_id)
        print(f"DEBUG: Verificación final - Username en DB: {user_check.username}")
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        print(f"DEBUG: ERROR: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@users_bp.route('/orders', methods=['GET'])
@jwt_required()
def get_user_orders():
    """Obtener historial de órdenes del usuario"""
    try:
        user_id = get_jwt_identity()
        
        # Obtener parámetros de paginación
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Obtener órdenes del usuario
        orders_query = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc())
        
        # Paginar resultados
        orders_paginated = orders_query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Formatear órdenes
        orders_list = []
        for order in orders_paginated.items:
            # Obtener items de la orden
            order_items = OrderItem.query.filter_by(order_id=order.id).all()
            
            items_list = []
            for item in order_items:
                items_list.append({
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': item.product_name,
                    'product_image_url': item.product_image_url,
                    'quantity': item.quantity,
                    'price': float(item.unit_price),  # Cambio: unit_price en vez de price
                    'total': float(item.total_price)  # Cambio: usar la property total_price
                })
            
            orders_list.append({
                'id': order.id,
                'order_number': f"ORD-{order.id:06d}",
                'status': order.status,
                'total_amount': float(order.total_amount),
                'items_count': len(items_list),
                'items': items_list,
                'shipping_address': order.shipping_address,
                'billing_address': order.billing_address,
                'payment_method': 'Stripe' if order.stripe_payment_intent_id else 'Pending',
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'updated_at': order.updated_at.isoformat() if order.updated_at else None
            })
        
        return jsonify({
            'orders': orders_list,
            'total': orders_paginated.total,
            'pages': orders_paginated.pages,
            'current_page': page,
            'per_page': per_page,
            'has_next': orders_paginated.has_next,
            'has_prev': orders_paginated.has_prev
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    """Cambiar contraseña del usuario"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Validar datos requeridos
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        # Verificar contraseña actual
        if not user.check_password(data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 400
        
        # Validar nueva contraseña
        if len(data['new_password']) < 6:
            return jsonify({'error': 'New password must be at least 6 characters'}), 400
        
        # Actualizar contraseña
        user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@users_bp.route('/delete-account', methods=['DELETE'])
@jwt_required()
def delete_account():
    """Delete user account with password confirmation"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        password = data.get('password')
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Verify password
        if not user.check_password(password):
            return jsonify({'error': 'Incorrect password'}), 401
        
        # Delete all related data (cart items and orders will cascade delete)
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': 'Account deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@users_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications_settings():
    """Obtener configuración de notificaciones"""
    try:
        user_id = get_jwt_identity()
        
        # Por ahora retornamos configuración por defecto
        # En el futuro esto vendría de una tabla user_preferences
        return jsonify({
            'email_notifications': True,
            'order_updates': True,
            'promotions': False,
            'newsletter': False
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/notifications', methods=['PUT'])
@jwt_required()
def update_notifications():
    """Update user notification preferences"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Update notification preference
        if 'email_notifications' in data:
            user.email_notifications = data['email_notifications']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Notification preferences updated successfully',
            'email_notifications': user.email_notifications
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@users_bp.route('/setup-admin-temp', methods=['GET'])
def setup_admin_temp():
    """Crear admin temporal - BORRAR DESPUÉS"""
    from werkzeug.security import generate_password_hash
    admin = User.query.filter_by(email='admin@example.com').first()
    if not admin:
        admin = User(
            username='Admin',
            email='admin@example.com',
            password_hash='scrypt:32768:8:1$IaNWB9eqW76zIvd5$18207d273efe979409df5203b88d944209c1a42c770962d222645a2e7870cb1cccdfdd79ad59349dd2b251941df98a95e17de549901d46405c53df29dcaf3d1f',
            is_admin=True
        )
        db.session.add(admin)
        db.session.commit()
        return jsonify({'message': 'Admin created'}), 201
    return jsonify({'message': 'Admin already exists'}), 200