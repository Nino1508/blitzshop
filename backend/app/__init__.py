from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
from datetime import timedelta
import logging
import os

# Inicializar extensiones
db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()

def _setup_logging(app: Flask) -> None:
    """
    Configura logging a consola a nivel INFO para toda la app,
    evitando múltiples handlers cuando el reloader de Flask reinicia.
    """
    # Formato claro: timestamp nivel [logger] mensaje
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(formatter)

    # Nivel por defecto (puedes subir a DEBUG en desarrollo si quieres)
    app.logger.setLevel(logging.INFO)

    # Evitar duplicados al recargar
    has_console = any(isinstance(h, logging.StreamHandler) for h in app.logger.handlers)
    if not has_console:
        app.logger.addHandler(console)

    # Opcional: propagar a root para que otros módulos (p.ej. app.routes.analytics)
    # también impriman sin configurar cada uno.
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_has_console = any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers)
    if not root_has_console:
        root_logger.addHandler(console)

def create_app():
    app = Flask(__name__)

    # --- Logging a consola ---
    _setup_logging(app)
    app.logger.info("[app.start] Configurando BlitzShop API")

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
    migrate.init_app(app, db)

    # ---------- CORS PROFESIONAL (Netlify + localhost) ----------
    # Puedes configurar ALLOWED_ORIGINS en Render (separadas por coma).
    raw_origins = os.environ.get(
        'ALLOWED_ORIGINS',
        'https://blitzshop.netlify.app,https://blitzshop-frontend.onrender.com,http://localhost:3000'
    )
    allowed_origins = [o.strip() for o in raw_origins.split(',') if o.strip()]
    app.logger.info(f"[app.cors] origins={allowed_origins}")

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
    from app.routes.analytics import analytics_bp
    from app.routes.invoices import invoices_bp
    from app.routes.coupons import coupons_bp
    from app.routes.reviews import reviews_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(cart_bp, url_prefix='/api/cart')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(payments_bp, url_prefix='/api/payments')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(invoices_bp, url_prefix='')
    app.register_blueprint(coupons_bp, url_prefix='/api/coupons')
    app.register_blueprint(reviews_bp, url_prefix='/api')

    # Crear tablas en la base de datos (si no usas migraciones)
    with app.app_context():
        db.create_all()
        app.logger.info("[app.db] Tablas OK (create_all ejecutado)")

    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'message': 'BlitzShop API is running!'}

    @app.route('/static/uploads/<filename>')
    def uploaded_file(filename):
        """Servir archivos subidos"""
        uploads_dir = os.path.join(os.getcwd(), 'static', 'uploads')
        return send_from_directory(uploads_dir, filename)

    app.logger.info("[app.ready] BlitzShop API lista")
    return app
