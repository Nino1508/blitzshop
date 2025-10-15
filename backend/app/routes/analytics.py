# backend/app/routes/analytics.py
from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from datetime import datetime, timedelta, date
from sqlalchemy import func, and_, desc, distinct
from decimal import Decimal
import logging
import csv
import io

from app import db
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.user import User

analytics_bp = Blueprint('analytics', __name__)
logger = logging.getLogger(__name__)

# ============== Helpers (data standards and validations) ==============

def to_float(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    try:
        return float(v)
    except Exception:
        return 0.0

def safe_date_str(d) -> str:
    # Puede venir como date, datetime o string (por func.date en distintos motores)
    if isinstance(d, (datetime, date)):
        return d.strftime('%Y-%m-%d')
    if isinstance(d, str):
        # asume 'YYYY-MM-DD' ya
        return d
    return ''

def safe_month_str(d) -> str:
    # Cuando usamos date_trunc retorna datetime; si ya es 'YYYY-MM' lo devolvemos
    if isinstance(d, (datetime, date)):
        return d.strftime('%Y-%m')
    if isinstance(d, str):
        return d  # asumimos ya 'YYYY-MM'
    return ''

def parse_int_param(name, default, min_value=None, max_value=None):
    raw = request.args.get(name, default)
    try:
        val = int(raw)
    except Exception:
        raise ValueError(f"Invalid value for '{name}'. Must be an integer.")
    if min_value is not None and val < min_value:
        raise ValueError(f"Invalid '{name}'. Must be >= {min_value}.")
    if max_value is not None and val > max_value:
        raise ValueError(f"Invalid '{name}'. Must be <= {max_value}.")
    return val

def parse_date_param(name, required=False):
    raw = request.args.get(name)
    if not raw:
        if required:
            raise ValueError(f"Missing required '{name}' (YYYY-MM-DD).")
        return None
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except Exception:
        raise ValueError(f"Invalid '{name}' format. Expected YYYY-MM-DD.")

def mask_email(email: str) -> str:
    if not email or '@' not in email:
        return email or 'N/A'
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        masked_local = local[0] + '*' * (len(local) - 1)
    else:
        masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"

def get_dialect_name() -> str:
    try:
        return db.session.bind.dialect.name  # 'postgresql', 'sqlite', etc.
    except Exception:
        return 'unknown'

# ===================== Decorator admin_required (consistente) =====================

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper

# ================================ Endpoints =================================

@analytics_bp.route('/dashboard', methods=['GET'])
@admin_required
def get_dashboard_metrics():
    """Main dashboard metrics"""
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    logger.info(f"[analytics.dashboard.start] user_id={user_id}")
    try:
        total_revenue = db.session.query(func.sum(Order.total_amount))\
            .filter(Order.status != 'cancelled').scalar() or 0
        total_orders = Order.query.filter(Order.status != 'cancelled').count()
        total_customers = User.query.filter_by(is_admin=False).count()

        today = datetime.now().date()
        today_revenue = db.session.query(func.sum(Order.total_amount))\
            .filter(and_(func.date(Order.created_at) == today,
                         Order.status != 'cancelled')).scalar() or 0

        avg_order_value = (to_float(total_revenue) / total_orders) if total_orders > 0 else 0.0

        low_stock_products = Product.query.filter(Product.stock < 10).count()

        yesterday = today - timedelta(days=1)
        yesterday_revenue = db.session.query(func.sum(Order.total_amount))\
            .filter(and_(func.date(Order.created_at) == yesterday,
                         Order.status != 'cancelled')).scalar() or 0

        growth = 0.0
        if to_float(yesterday_revenue) > 0:
            growth = ((to_float(today_revenue) - to_float(yesterday_revenue)) / to_float(yesterday_revenue)) * 100.0

        result = {
            'total_revenue': to_float(total_revenue),
            'total_orders': total_orders,
            'total_customers': total_customers,
            'today_revenue': to_float(today_revenue),
            'yesterday_revenue': to_float(yesterday_revenue),
            'growth_percentage': round(growth, 1),
            'avg_order_value': round(to_float(avg_order_value), 2),
            'low_stock_alert': low_stock_products
        }
        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.dashboard.ok] user_id={user_id} status=200 ms={ms:.2f}")
        return jsonify(result), 200

    except ValueError as ve:
        logger.info(f"[analytics.dashboard.bad_request] {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception("[analytics.dashboard.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/revenue/daily', methods=['GET'])
@admin_required
def get_daily_revenue():
    """Revenue for last N days"""
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    raw_days = request.args.get('days', 7)
    try:
        days = parse_int_param('days', raw_days, min_value=1, max_value=365)
        logger.info(f"[analytics.daily.start] user_id={user_id} days={days}")

        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days-1)

        rows = db.session.query(
            func.date(Order.created_at).label('dt'),
            func.sum(Order.total_amount).label('revenue'),
            func.count(Order.id).label('orders')
        ).filter(
            and_(
                func.date(Order.created_at) >= start_date,
                func.date(Order.created_at) <= end_date,
                Order.status != 'cancelled'
            )
        ).group_by(func.date(Order.created_at)).all()

        # Mapa completo por fecha
        series = {}
        cur = start_date
        while cur <= end_date:
            key = cur.strftime('%Y-%m-%d')
            series[key] = {'date': key, 'revenue': 0.0, 'orders': 0}
            cur += timedelta(days=1)

        for r in rows:
            key = safe_date_str(r.dt)  # dt puede llegar como str o date
            series[key] = {
                'date': key,
                'revenue': to_float(r.revenue),
                'orders': int(r.orders or 0)
            }

        data = list(series.values())

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.daily.ok] user_id={user_id} days={days} status=200 ms={ms:.2f}")
        return jsonify(data), 200

    except ValueError as ve:
        logger.info(f"[analytics.daily.bad_request] {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception("[analytics.daily.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/revenue/monthly', methods=['GET'])
@admin_required
def get_monthly_revenue():
    """Revenue by month (last 12 months) – compatible con SQLite y PostgreSQL"""
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    logger.info(f"[analytics.monthly.start] user_id={user_id}")
    try:
        dialect = get_dialect_name()
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=365)

        if dialect == 'postgresql':
            # date_trunc + to_char
            month_expr = func.to_char(func.date_trunc('month', Order.created_at), 'YYYY-MM')
            rows = db.session.query(
                month_expr.label('month'),
                func.sum(Order.total_amount).label('revenue'),
                func.count(Order.id).label('orders')
            ).filter(
                and_(Order.created_at >= start_date,
                     Order.status != 'cancelled')
            ).group_by(month_expr).order_by(month_expr).all()

        else:
            # SQLite (y en muchos casos traducido por SQLAlchemy)
            month_expr = func.strftime('%Y-%m', Order.created_at)
            rows = db.session.query(
                month_expr.label('month'),
                func.sum(Order.total_amount).label('revenue'),
                func.count(Order.id).label('orders')
            ).filter(
                and_(Order.created_at >= start_date,
                     Order.status != 'cancelled')
            ).group_by(month_expr).order_by(month_expr).all()

        data = [{
            'month': safe_month_str(r.month),
            'revenue': to_float(r.revenue),
            'orders': int(r.orders or 0)
        } for r in rows]

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.monthly.ok] user_id={user_id} status=200 ms={ms:.2f}")
        return jsonify(data), 200

    except Exception as e:
        logger.exception("[analytics.monthly.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/products/top', methods=['GET'])
@admin_required
def get_top_products():
    """Top selling products - CORREGIDO para devolver array directo"""
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    try:
        limit = parse_int_param('limit', request.args.get('limit', 10), min_value=1, max_value=100)
        logger.info(f"[analytics.products_top.start] user_id={user_id} limit={limit}")

        # Query simplificada que devuelve array directo
        items = db.session.query(
            Product.id.label('pid'),
            Product.name,
            Product.price,
            Product.stock,
            func.coalesce(func.sum(OrderItem.quantity), 0).label('units_sold'),
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price), 0).label('revenue')
        ).outerjoin(
            OrderItem, Product.id == OrderItem.product_id
        ).outerjoin(
            Order, and_(Order.id == OrderItem.order_id, Order.status != 'cancelled')
        ).group_by(
            Product.id, Product.name, Product.price, Product.stock
        ).order_by(
            desc('revenue'), desc('units_sold')
        ).limit(limit).all()

        # Return direct array, not object with pagination
        data = [{
            'id': row.pid,
            'name': row.name,
            'price': to_float(row.price),
            'stock': int(row.stock or 0),
            'units_sold': int(row.units_sold or 0),
            'revenue': to_float(row.revenue)
        } for row in items]

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.products_top.ok] user_id={user_id} count={len(data)} status=200 ms={ms:.2f}")
        return jsonify(data), 200

    except ValueError as ve:
        logger.info(f"[analytics.products_top.bad_request] {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception("[analytics.products_top.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/products/low-stock', methods=['GET'])
@admin_required
def get_low_stock_products():
    """Products with low stock"""
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    try:
        threshold = parse_int_param('threshold', request.args.get('threshold', 10), min_value=1, max_value=100000)
        logger.info(f"[analytics.low_stock.start] user_id={user_id} threshold={threshold}")

        low_stock = Product.query.filter(Product.stock < threshold).order_by(Product.stock.asc()).all()

        data = [{
            'id': p.id,
            'name': p.name,
            'stock': int(p.stock or 0),
            'price': to_float(p.price),
            'category': p.category or 'Uncategorized'
        } for p in low_stock]

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.low_stock.ok] user_id={user_id} count={len(data)} status=200 ms={ms:.2f}")
        return jsonify(data), 200

    except ValueError as ve:
        logger.info(f"[analytics.low_stock.bad_request] {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception("[analytics.low_stock.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/customers/top', methods=['GET'])
@admin_required
def get_top_customers():
    """Top customers - CORREGIDO para devolver array directo"""
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    try:
        limit = parse_int_param('limit', request.args.get('limit', 10), min_value=1, max_value=100)
        logger.info(f"[analytics.customers_top.start] user_id={user_id} limit={limit}")

        # Query simplificada que devuelve array directo
        items = db.session.query(
            User.id.label('uid'),
            User.username,
            User.email,
            User.first_name,
            User.last_name,
            func.count(distinct(Order.id)).label('total_orders'),
            func.coalesce(func.sum(Order.total_amount), 0).label('total_spent')
        ).outerjoin(
            Order, and_(User.id == Order.user_id, Order.status != 'cancelled')
        ).filter(
            User.is_admin == False
        ).group_by(
            User.id, User.username, User.email, User.first_name, User.last_name
        ).having(
            func.count(distinct(Order.id)) > 0  # Solo usuarios con órdenes
        ).order_by(
            desc('total_spent')
        ).limit(limit).all()

        # Devolver array directo
        data = [{
            'id': r.uid,
            'username': r.username or f"{r.first_name or ''} {r.last_name or ''}".strip() or 'N/A',
            'email': r.email,
            'total_orders': int(r.total_orders or 0),
            'total_spent': to_float(r.total_spent)
        } for r in items]

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.customers_top.ok] user_id={user_id} count={len(data)} status=200 ms={ms:.2f}")
        return jsonify(data), 200

    except ValueError as ve:
        logger.info(f"[analytics.customers_top.bad_request] {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception("[analytics.customers_top.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/categories/performance', methods=['GET'])
@admin_required
def get_category_performance():
    """Sales performance by category"""
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    logger.info(f"[analytics.categories.start] user_id={user_id}")
    try:
        rows = db.session.query(
            Product.category,
            func.count(distinct(Product.id)).label('product_count'),
            func.coalesce(func.sum(OrderItem.quantity), 0).label('units_sold'),
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price), 0).label('revenue')
        ).outerjoin(
            OrderItem, Product.id == OrderItem.product_id
        ).outerjoin(
            Order, and_(Order.id == OrderItem.order_id, Order.status != 'cancelled')
        ).group_by(Product.category).all()

        total_revenue = sum([to_float(r.revenue) for r in rows])

        result = []
        for r in rows:
            revenue = to_float(r.revenue)
            percentage = (revenue / total_revenue * 100.0) if total_revenue > 0 else 0.0
            result.append({
                'category': r.category or 'Uncategorized',
                'product_count': int(r.product_count or 0),
                'units_sold': int(r.units_sold or 0),
                'revenue': revenue,
                'percentage': round(percentage, 1)
            })

        result.sort(key=lambda x: x['revenue'], reverse=True)

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.categories.ok] user_id={user_id} count={len(result)} status=200 ms={ms:.2f}")
        return jsonify(result), 200

    except Exception as e:
        logger.exception("[analytics.categories.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/export', methods=['GET'])
@admin_required
def export_analytics():
    """
    NUEVO ENDPOINT: Export compatible con frontend actual
    Acepta 'days' en lugar de start_date/end_date
    """
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    try:
        report_type = request.args.get('type', 'orders')
        
        # Aceptar tanto 'days' como 'start_date/end_date'
        if request.args.get('start_date') and request.args.get('end_date'):
            # If explicit dates come, use them
            start_date = parse_date_param('start_date', required=True)
            end_date = parse_date_param('end_date', required=True)
        else:
            # Si viene 'days', calcular las fechas
            days = parse_int_param('days', request.args.get('days', 7), min_value=1, max_value=365)
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days-1)
        
        if start_date > end_date:
            raise ValueError("start_date must be <= end_date.")

        logger.info(f"[analytics.export.start] user_id={user_id} type={report_type} range={start_date}..{end_date}")

        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == 'orders':
            writer.writerow(['Order ID', 'Date', 'Customer', 'Email', 'Total', 'Status'])
            orders = db.session.query(
                Order.id,
                Order.created_at,
                User.username,
                User.email,
                Order.total_amount,
                Order.status
            ).join(User, Order.user_id == User.id)\
             .filter(and_(func.date(Order.created_at) >= start_date,
                          func.date(Order.created_at) <= end_date))\
             .order_by(desc(Order.created_at)).all()

            for o in orders:
                writer.writerow([
                    o.id,
                    o.created_at.strftime('%Y-%m-%d %H:%M') if isinstance(o.created_at, (datetime,)) else str(o.created_at),
                    o.username or 'N/A',
                    mask_email(o.email),
                    to_float(o.total_amount),
                    o.status
                ])

        elif report_type == 'products':
            writer.writerow(['Product ID', 'Name', 'Category', 'Price', 'Stock', 'Units Sold', 'Revenue'])
            products = db.session.query(
                Product.id,
                Product.name,
                Product.category,
                Product.price,
                Product.stock,
                func.coalesce(func.sum(OrderItem.quantity), 0).label('units_sold'),
                func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price), 0).label('revenue')
            ).outerjoin(
                OrderItem, Product.id == OrderItem.product_id
            ).outerjoin(
                Order, and_(Order.id == OrderItem.order_id,
                            Order.status != 'cancelled',
                            func.date(Order.created_at) >= start_date,
                            func.date(Order.created_at) <= end_date)
            ).group_by(
                Product.id, Product.name, Product.category, Product.price, Product.stock
            ).all()

            for p in products:
                writer.writerow([
                    p.id,
                    p.name,
                    p.category or 'Uncategorized',
                    to_float(p.price),
                    int(p.stock or 0),
                    int(p.units_sold or 0),
                    to_float(p.revenue)
                ])

        elif report_type == 'customers':
            writer.writerow(['Customer ID', 'Username', 'Email', 'Total Orders', 'Total Spent'])
            customers = db.session.query(
                User.id,
                User.username,
                User.email,
                func.count(distinct(Order.id)).label('total_orders'),
                func.coalesce(func.sum(Order.total_amount), 0).label('total_spent')
            ).outerjoin(
                Order, and_(User.id == Order.user_id,
                            Order.status != 'cancelled',
                            func.date(Order.created_at) >= start_date,
                            func.date(Order.created_at) <= end_date)
            ).filter(
                User.is_admin == False
            ).group_by(
                User.id, User.username, User.email
            ).all()

            for c in customers:
                writer.writerow([
                    c.id,
                    c.username or 'N/A',
                    mask_email(c.email),
                    int(c.total_orders or 0),
                    to_float(c.total_spent)
                ])
        else:
            return jsonify({'error': "Invalid 'type'. Use 'orders' | 'products' | 'customers'."}), 400

        output.seek(0)
        filename = f'analytics_{report_type}_{start_date}_{end_date}.csv'

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.export.ok] user_id={user_id} type={report_type} status=200 ms={ms:.2f}")

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )

    except ValueError as ve:
        logger.info(f"[analytics.export.bad_request] {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception("[analytics.export.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/export/csv', methods=['GET'])
@admin_required
def export_analytics_csv():
    """
    Export analytics CSV (endpoint original, mantiene compatibilidad)
    - Requiere start_date y end_date (YYYY-MM-DD).
    """
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    try:
        report_type = request.args.get('type', 'orders')
        start_date = parse_date_param('start_date', required=True)
        end_date = parse_date_param('end_date', required=True)
        if start_date > end_date:
            raise ValueError("start_date must be <= end_date.")

        logger.info(f"[analytics.export.start] user_id={user_id} type={report_type} range={start_date}..{end_date}")

        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == 'orders':
            writer.writerow(['Order ID', 'Date', 'Customer', 'Email', 'Total', 'Status'])
            orders = db.session.query(
                Order.id,
                Order.created_at,
                User.username,
                User.email,
                Order.total_amount,
                Order.status
            ).join(User, Order.user_id == User.id)\
             .filter(and_(func.date(Order.created_at) >= start_date,
                          func.date(Order.created_at) <= end_date))\
             .order_by(desc(Order.created_at)).all()

            for o in orders:
                writer.writerow([
                    o.id,
                    o.created_at.strftime('%Y-%m-%d %H:%M') if isinstance(o.created_at, (datetime,)) else str(o.created_at),
                    o.username or 'N/A',
                    mask_email(o.email),
                    to_float(o.total_amount),
                    o.status
                ])

        elif report_type == 'products':
            writer.writerow(['Product ID', 'Name', 'Category', 'Price', 'Stock', 'Units Sold', 'Revenue'])
            products = db.session.query(
                Product.id,
                Product.name,
                Product.category,
                Product.price,
                Product.stock,
                func.coalesce(func.sum(OrderItem.quantity), 0).label('units_sold'),
                func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price), 0).label('revenue')
            ).outerjoin(
                OrderItem, Product.id == OrderItem.product_id
            ).outerjoin(
                Order, and_(Order.id == OrderItem.order_id,
                            Order.status != 'cancelled',
                            func.date(Order.created_at) >= start_date,
                            func.date(Order.created_at) <= end_date)
            ).group_by(
                Product.id, Product.name, Product.category, Product.price, Product.stock
            ).all()

            for p in products:
                writer.writerow([
                    p.id,
                    p.name,
                    p.category or 'Uncategorized',
                    to_float(p.price),
                    int(p.stock or 0),
                    int(p.units_sold or 0),
                    to_float(p.revenue)
                ])

        elif report_type == 'customers':
            writer.writerow(['Customer ID', 'Username', 'Email', 'Total Orders', 'Total Spent'])
            customers = db.session.query(
                User.id,
                User.username,
                User.email,
                func.count(distinct(Order.id)).label('total_orders'),
                func.coalesce(func.sum(Order.total_amount), 0).label('total_spent')
            ).outerjoin(
                Order, and_(User.id == Order.user_id,
                            Order.status != 'cancelled',
                            func.date(Order.created_at) >= start_date,
                            func.date(Order.created_at) <= end_date)
            ).filter(
                User.is_admin == False
            ).group_by(
                User.id, User.username, User.email
            ).all()

            for c in customers:
                writer.writerow([
                    c.id,
                    c.username or 'N/A',
                    mask_email(c.email),
                    int(c.total_orders or 0),
                    to_float(c.total_spent)
                ])
        else:
            return jsonify({'error': "Invalid 'type'. Use 'orders' | 'products' | 'customers'."}), 400

        output.seek(0)
        filename = f'analytics_{report_type}_{start_date}_{end_date}.csv'

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.export.ok] user_id={user_id} type={report_type} status=200 ms={ms:.2f}")

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )

    except ValueError as ve:
        logger.info(f"[analytics.export.bad_request] {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception("[analytics.export.error]")
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/summary', methods=['GET'])
@admin_required
def get_analytics_summary():
    """Complete analytics summary for selected period"""
    start_ts = datetime.now()
    user_id = get_jwt_identity()
    raw_days = request.args.get('days', 30)
    try:
        days = parse_int_param('days', raw_days, min_value=1, max_value=365)
        logger.info(f"[analytics.summary.start] user_id={user_id} days={days}")

        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days-1)

        sales_summary = db.session.query(
            func.count(Order.id).label('total_orders'),
            func.sum(Order.total_amount).label('total_revenue'),
            func.avg(Order.total_amount).label('avg_order_value')
        ).filter(and_(func.date(Order.created_at) >= start_date,
                      func.date(Order.created_at) <= end_date,
                      Order.status != 'cancelled')).first()

        best_category = db.session.query(
            Product.category,
            func.sum(OrderItem.quantity * OrderItem.unit_price).label('revenue')
        ).join(
            OrderItem, Product.id == OrderItem.product_id
        ).join(
            Order, and_(
                Order.id == OrderItem.order_id,
                Order.status != 'cancelled',
                func.date(Order.created_at) >= start_date,
                func.date(Order.created_at) <= end_date
            )
        ).group_by(Product.category).order_by(desc('revenue')).first()

        new_customers = User.query.filter(and_(
            func.date(User.created_at) >= start_date,
            func.date(User.created_at) <= end_date,
            User.is_admin == False
        )).count()

        payload = {
            'period_days': days,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'total_orders': int(sales_summary.total_orders or 0) if sales_summary else 0,
            'total_revenue': to_float(sales_summary.total_revenue) if sales_summary else 0.0,
            'avg_order_value': to_float(sales_summary.avg_order_value) if sales_summary else 0.0,
            'best_category': (best_category.category if best_category and best_category.category else 'N/A'),
            'best_category_revenue': to_float(best_category.revenue) if best_category else 0.0,
            'new_customers': int(new_customers or 0)
        }

        ms = (datetime.now() - start_ts).total_seconds()*1000
        logger.info(f"[analytics.summary.ok] user_id={user_id} status=200 ms={ms:.2f}")
        return jsonify(payload), 200

    except ValueError as ve:
        logger.info(f"[analytics.summary.bad_request] {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception("[analytics.summary.error]")
        return jsonify({'error': str(e)}), 500