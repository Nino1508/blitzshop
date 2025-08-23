from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from datetime import timedelta
import os

# Inicializar extensiones
db = SQLAlchemy()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    
    # Configuración de la aplicación
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///ecommerce.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Configuración JWT
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-change-in-production')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
    
    # Inicializar extensiones con la app
    db.init_app(app)
    jwt.init_app(app)

    # ---------- CORS PROFESIONAL (Netlify + localhost) ----------
    # Puedes configurar ALLOWED_ORIGINS en Render (separadas por coma).
    # Si no está, por defecto habilita tu Netlify y el localhost.
    allowed_origins = os.environ.get(
        'ALLOWED_ORIGINS',
        'https://blitzshop.netlify.app,https://blitzshop-frontend.onrender.com,http://localhost:3000'
    ).split(',')

    # Limitar CORS a las rutas de API y permitir Authorization
    CORS(
        app,
        resources={r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }}
    )
    # ------------------------------------------------------------

    # Registrar blueprints (rutas)
    from app.routes.auth import auth_bp
    from app.routes.products import products_bp
    from app.routes.admin import admin_bp
    from app.routes.cart import cart_bp
    from app.routes.orders import orders_bp
    from app.routes.payments import payments_bp
    from app.routes.users import users_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(cart_bp, url_prefix='/api/cart')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(payments_bp, url_prefix='/api/payments')
    app.register_blueprint(users_bp, url_prefix='/api/users')
   
    # Crear tablas en la base de datos (si no usas migraciones)
    with app.app_context():
        db.create_all()
        
    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'message': 'BlitzShop API is running!'}

    @app.route('/static/uploads/<filename>')
    def uploaded_file(filename):
        """Servir archivos subidos"""
        uploads_dir = os.path.join(os.getcwd(), 'static', 'uploads')
        return send_from_directory(uploads_dir, filename)
    
    return app
