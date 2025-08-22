from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.product import Product
from app import db
import os
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# Configuración de upload
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def admin_required(f):
    """Decorator para verificar que el usuario sea admin"""
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@admin_bp.route('/products', methods=['GET'])
@jwt_required()
@admin_required
def get_all_products():
    """Obtener todos los productos con paginación para admin"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '', type=str)
        category = request.args.get('category', '', type=str)
        
        query = Product.query
        
        # Filtros
        if search:
            query = query.filter(Product.name.contains(search))
        if category:
            query = query.filter(Product.category == category)
            
        # Ordenar por fecha de creación (más recientes primero)
        query = query.order_by(Product.id.desc())
        
        # Paginación
        products = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return jsonify({
            'products': [{
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'price': float(p.price),
                'category': p.category,
                'image_url': p.image_url,
                'stock_quantity': p.stock,  # Usar stock directamente
                'is_active': p.is_active,
                'created_at': p.created_at.isoformat() if p.created_at else None
            } for p in products.items],
            'pagination': {
                'page': products.page,
                'pages': products.pages,
                'per_page': products.per_page,
                'total': products.total,
                'has_next': products.has_next,
                'has_prev': products.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Error fetching products: {str(e)}'}), 500

@admin_bp.route('/products', methods=['POST'])
@jwt_required()
@admin_required
def create_product():
    """Crear nuevo producto"""
    try:
        # Siempre usar form data cuando hay archivos
        name = request.form.get('name')
        description = request.form.get('description')
        price = request.form.get('price')
        category = request.form.get('category')
        stock_quantity = request.form.get('stock_quantity', 0)
        is_active = request.form.get('is_active', 'true').lower() == 'true'
        image_file = request.files.get('image')
        
        # Si no hay datos en form, intentar JSON
        if not name:
            data = request.get_json()
            if data:
                name = data.get('name')
                description = data.get('description')
                price = data.get('price')
                category = data.get('category')
                stock_quantity = data.get('stock_quantity', 0)
                is_active = data.get('is_active', True)
                image_file = None
        
        # Validaciones
        if not name or not price or not category:
            return jsonify({'error': 'Name, price and category are required'}), 400
            
        try:
            price = float(price)
            stock_quantity = int(stock_quantity)
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid price or stock quantity'}), 400
            
        if price < 0 or stock_quantity < 0:
            return jsonify({'error': 'Price and stock cannot be negative'}), 400
        
        # Verificar que el nombre no exista
        existing_product = Product.query.filter_by(name=name).first()
        if existing_product:
            return jsonify({'error': 'Product with this name already exists'}), 400
        
        # Manejar upload de imagen
        image_url = None
        if image_file and image_file.filename != '':
            if allowed_file(image_file.filename):
                # Crear directorio si no existe
                os.makedirs(UPLOAD_FOLDER, exist_ok=True)
                
                # Generar nombre único
                filename = secure_filename(image_file.filename)
                unique_filename = f"{uuid.uuid4()}_{filename}"
                filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
                
                # Guardar archivo
                image_file.save(filepath)
                image_url = f"http://localhost:5000/static/uploads/{unique_filename}"
            else:
                return jsonify({'error': 'Invalid image format. Use PNG, JPG, JPEG, GIF or WEBP'}), 400
        
        # Crear producto usando el constructor correcto
        product = Product(
            name=name,
            price=price,
            description=description or '',
            stock=stock_quantity,
            category=category,
            image_url=image_url,
            is_active=is_active
        )
        
        db.session.add(product)
        db.session.commit()
        
        return jsonify({
            'message': 'Product created successfully',
            'product': {
                'id': product.id,
                'name': product.name,
                'description': product.description,
                'price': float(product.price),
                'category': product.category,
                'image_url': product.image_url,
                'stock_quantity': product.stock,
                'is_active': product.is_active
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error creating product: {str(e)}'}), 500

@admin_bp.route('/products/<int:product_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_product(product_id):
    """Actualizar producto existente"""
    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Siempre usar form data cuando hay archivos
        name = request.form.get('name')
        description = request.form.get('description')
        price = request.form.get('price')
        category = request.form.get('category')
        stock_quantity = request.form.get('stock_quantity')
        is_active = request.form.get('is_active', 'true').lower() == 'true'
        image_file = request.files.get('image')
        
        # Si no hay datos en form, intentar JSON
        if not name:
            data = request.get_json()
            if data:
                name = data.get('name')
                description = data.get('description')
                price = data.get('price')
                category = data.get('category')
                stock_quantity = data.get('stock_quantity')
                is_active = data.get('is_active', True)
                image_file = None
        
        # Validaciones y actualizaciones
        if name is not None:
            if not name.strip():
                return jsonify({'error': 'Name cannot be empty'}), 400
            existing = Product.query.filter(Product.name == name, Product.id != product_id).first()
            if existing:
                return jsonify({'error': 'Product with this name already exists'}), 400
            product.name = name
            
        if description is not None:
            product.description = description
            
        if price is not None:
            try:
                price = float(price)
                if price < 0:
                    return jsonify({'error': 'Price cannot be negative'}), 400
                product.price = price
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid price format'}), 400
                
        if category is not None:
            if not category.strip():
                return jsonify({'error': 'Category cannot be empty'}), 400
            product.category = category
            
        if stock_quantity is not None:
            try:
                stock = int(stock_quantity)
                if stock < 0:
                    return jsonify({'error': 'Stock cannot be negative'}), 400
                product.stock = stock
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid stock quantity format'}), 400
                
        if is_active is not None:
            product.is_active = is_active
        
        # Manejar nueva imagen
        if image_file and image_file.filename != '':
            if allowed_file(image_file.filename):
                # Eliminar imagen anterior si existe
                if product.image_url and 'localhost:5000' in product.image_url:
                    # Extraer solo el nombre del archivo
                    old_filename = product.image_url.split('/')[-1]
                    old_filepath = os.path.join(UPLOAD_FOLDER, old_filename)
                    if os.path.exists(old_filepath):
                        os.remove(old_filepath)
                
                # Guardar nueva imagen
                os.makedirs(UPLOAD_FOLDER, exist_ok=True)
                filename = secure_filename(image_file.filename)
                unique_filename = f"{uuid.uuid4()}_{filename}"
                filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
                image_file.save(filepath)
                product.image_url = f"http://localhost:5000/static/uploads/{unique_filename}"
            else:
                return jsonify({'error': 'Invalid image format'}), 400
        
        db.session.commit()
        
        return jsonify({
            'message': 'Product updated successfully',
            'product': {
                'id': product.id,
                'name': product.name,
                'description': product.description,
                'price': float(product.price),
                'category': product.category,
                'image_url': product.image_url,
                'stock_quantity': product.stock,
                'is_active': product.is_active
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating product: {str(e)}'}), 500

@admin_bp.route('/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_product(product_id):
    """Eliminar producto permanentemente"""
    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Eliminar imagen si existe
        if product.image_url and 'localhost:5000' in product.image_url:
            old_filename = product.image_url.split('/')[-1]
            old_filepath = os.path.join(UPLOAD_FOLDER, old_filename)
            if os.path.exists(old_filepath):
                os.remove(old_filepath)
        
        # Hard delete - eliminar permanentemente
        db.session.delete(product)
        db.session.commit()
        
        return jsonify({'message': 'Product deleted permanently'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting product: {str(e)}'}), 500

@admin_bp.route('/products/<int:product_id>/toggle-status', methods=['PATCH'])
@jwt_required()
@admin_required
def toggle_product_status(product_id):
    """Activar/desactivar producto"""
    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        product.is_active = not product.is_active
        db.session.commit()
        
        status = 'activated' if product.is_active else 'deactivated'
        return jsonify({
            'message': f'Product {status} successfully',
            'is_active': product.is_active
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error toggling product status: {str(e)}'}), 500

@admin_bp.route('/categories', methods=['GET'])
@jwt_required()
@admin_required
def get_categories():
    """Obtener todas las categorías únicas"""
    try:
        categories = db.session.query(Product.category).distinct().all()
        categories = [cat[0] for cat in categories if cat[0]]
        return jsonify({'categories': sorted(categories)}), 200
    except Exception as e:
        return jsonify({'error': f'Error fetching categories: {str(e)}'}), 500
    
@admin_bp.route('/orders', methods=['GET'])
@jwt_required()
@admin_required
def get_all_orders():
    """Obtener todas las órdenes del sistema"""
    try:
        from app.models.order import Order, OrderItem
        from app.models.user import User
        
        # Filtros
        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Query base con join para obtener email del usuario
        query = db.session.query(Order, User.email).join(User)
        
        if status and status != 'all':
            query = query.filter(Order.status == status)
        
        # Ordenar por fecha descendente
        query = query.order_by(Order.created_at.desc())
        
        # Paginar
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        orders_list = []
        for order, user_email in paginated.items:
            # Obtener items de cada orden
            items = OrderItem.query.filter_by(order_id=order.id).all()
            
            orders_list.append({
                'id': order.id,
                'user_email': user_email,
                'total_amount': float(order.total_amount),
                'status': order.status,
                'created_at': order.created_at.isoformat(),
                'updated_at': order.updated_at.isoformat() if order.updated_at else None,
                'shipping_address': order.shipping_address,
                'billing_address': order.billing_address,
                'items': [{
                    'id': item.id,
                    'product_name': item.product_name,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'total_price': float(item.total_price)
                } for item in items]
            })
        
        return jsonify({
            'orders': orders_list,
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@jwt_required()
@admin_required
def update_order_status(order_id):
    """Actualizar estado de una orden"""
    try:
        from app.models.order import Order
        
        order = Order.query.get_or_404(order_id)
        data = request.get_json()
        
        valid_statuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
        new_status = data.get('status')
        
        if new_status not in valid_statuses:
            return jsonify({'error': 'Invalid status'}), 400
        
        order.status = new_status
        order.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Order status updated',
            'order_id': order_id,
            'new_status': new_status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500