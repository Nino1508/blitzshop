"""
Script de seeding para generar demo data profesional:
- Usuarios fake con nombres realistas
- Órdenes aleatorias de productos
- Reviews con ratings y comentarios variados

Ejecutar: python seed_reviews.py
"""

import random
from datetime import datetime, timedelta, timezone
from app import create_app, db
from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.review import Review

# Datos demo realistas
DEMO_USERS = [
    {"username": "maria_garcia", "email": "maria.g@example.com", "first_name": "María", "last_name": "García"},
    {"username": "carlos_rodriguez", "email": "carlos.r@example.com", "first_name": "Carlos", "last_name": "Rodríguez"},
    {"username": "ana_lopez", "email": "ana.lopez@example.com", "first_name": "Ana", "last_name": "López"},
    {"username": "juan_martinez", "email": "juan.m@example.com", "first_name": "Juan", "last_name": "Martínez"},
    {"username": "laura_sanchez", "email": "laura.s@example.com", "first_name": "Laura", "last_name": "Sánchez"},
    {"username": "david_fernandez", "email": "david.f@example.com", "first_name": "David", "last_name": "Fernández"},
    {"username": "sofia_gomez", "email": "sofia.g@example.com", "first_name": "Sofía", "last_name": "Gómez"},
    {"username": "miguel_diaz", "email": "miguel.d@example.com", "first_name": "Miguel", "last_name": "Díaz"},
    {"username": "elena_ruiz", "email": "elena.r@example.com", "first_name": "Elena", "last_name": "Ruiz"},
    {"username": "pablo_torres", "email": "pablo.t@example.com", "first_name": "Pablo", "last_name": "Torres"},
    {"username": "lucia_ramirez", "email": "lucia.r@example.com", "first_name": "Lucía", "last_name": "Ramírez"},
    {"username": "jorge_silva", "email": "jorge.s@example.com", "first_name": "Jorge", "last_name": "Silva"},
    {"username": "carmen_moreno", "email": "carmen.m@example.com", "first_name": "Carmen", "last_name": "Moreno"},
    {"username": "raul_navarro", "email": "raul.n@example.com", "first_name": "Raúl", "last_name": "Navarro"},
    {"username": "isabel_jimenez", "email": "isabel.j@example.com", "first_name": "Isabel", "last_name": "Jiménez"},
]

# Comentarios realistas en español e inglés
REVIEW_COMMENTS = {
    5: [  # 5 estrellas - Excelente
        "Excelente producto, superó mis expectativas. Muy recomendado.",
        "¡Perfecto! Justo lo que buscaba. Calidad premium.",
        "Amazing quality! Fast delivery and great customer service.",
        "Producto de primera calidad. Llegó antes de lo esperado.",
        "Love it! Worth every penny. Will buy again for sure.",
        "Increíble relación calidad-precio. No puedo estar más contento.",
        "Outstanding product! Exactly as described. Highly recommend.",
    ],
    4: [  # 4 estrellas - Muy bueno
        "Muy buen producto en general. Cumple con lo prometido.",
        "Good quality, though a bit pricey. Still satisfied with the purchase.",
        "Buena compra. Le pondría 5 estrellas si el envío fuera más rápido.",
        "Great product! Only minor improvement would be better packaging.",
        "Funciona perfectamente. Solo le falta algún accesorio adicional.",
        "Really good! Meets expectations. Would recommend to friends.",
    ],
    3: [  # 3 estrellas - Está bien
        "Está bien, pero esperaba algo mejor por el precio.",
        "It's okay. Does the job but nothing special.",
        "Producto correcto, pero tiene algunos detalles mejorables.",
        "Decent quality. Had some minor issues but overall acceptable.",
        "No está mal, pero tampoco es extraordinario.",
    ],
    2: [  # 2 estrellas - Regular
        "No cumple del todo con las expectativas. Calidad regular.",
        "Disappointed. Not as good as I expected from the description.",
        "La calidad podría ser mejor. No lo volvería a comprar.",
    ],
    1: [  # 1 estrella - Malo
        "Muy decepcionado. No recomendaría este producto.",
        "Poor quality. Had to return it. Not worth the money.",
    ]
}

REVIEW_TITLES = {
    5: ["Excelente compra!", "¡Lo mejor!", "Perfecto", "Altamente recomendado", "Amazing product!", "Outstanding quality"],
    4: ["Muy bueno", "Buena compra", "Recomendable", "Good quality", "Worth it", "Pretty good"],
    3: ["Está bien", "Correcto", "It's okay", "Average", "Not bad"],
    2: ["Regular", "Could be better", "Decepcionante", "Not great"],
    1: ["Malo", "No lo recomiendo", "Disappointed", "Poor quality"]
}


def random_date(start_days_ago=90, end_days_ago=1):
    """Generar fecha aleatoria en el rango especificado"""
    start = datetime.now(timezone.utc) - timedelta(days=start_days_ago)
    end = datetime.now(timezone.utc) - timedelta(days=end_days_ago)
    delta = end - start
    random_seconds = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=random_seconds)


def create_demo_users(app):
    """Crear usuarios demo"""
    print("\n📝 Creando usuarios demo...")
    created_users = []
    
    for user_data in DEMO_USERS:
        # Verificar si el usuario ya existe
        existing = User.query.filter_by(email=user_data["email"]).first()
        if existing:
            print(f"  ⏭️  Usuario {user_data['username']} ya existe, usando existente")
            created_users.append(existing)
            continue
        
        user = User(
            email=user_data["email"],
            password="demo123",
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            username=user_data["username"]
        )
        user.created_at = random_date(180, 30)
        
        db.session.add(user)
        created_users.append(user)
        print(f"  ✓ Creado: {user_data['username']}")
    
    db.session.commit()
    print(f"✅ {len(created_users)} usuarios disponibles")
    return created_users


def create_demo_orders(app, users, num_orders=40):
    """Crear órdenes demo con productos aleatorios"""
    print(f"\n📦 Creando {num_orders} órdenes demo...")
    
    products = Product.query.filter_by(is_active=True).all()
    if not products:
        print("  ⚠️  No hay productos activos. Crea productos primero.")
        return []
    
    created_orders = []
    
    for i in range(num_orders):
        # Usuario aleatorio
        user = random.choice(users)
        
        # Fecha aleatoria en los últimos 90 días
        order_date = random_date(90, 5)
        
        # Crear orden
        order = Order(
            user_id=user.id,
            total_amount=0
        )
        order.status = random.choice(['delivered', 'delivered', 'delivered', 'shipped'])  # Más delivered
        order.created_at = order_date
        
        db.session.add(order)
        db.session.flush()  # Para obtener order.id
        
        # Agregar 1-3 productos a la orden
        num_items = random.randint(1, 3)
        selected_products = random.sample(products, min(num_items, len(products)))
        
        total = 0
        for product in selected_products:
            quantity = random.randint(1, 2)
            item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=product.price,
                product_name=product.name,
                product_image_url=product.image_url
            )
            db.session.add(item)
            total += product.price * quantity
        
        order.total_amount = total
        created_orders.append(order)
    
    db.session.commit()
    print(f"✅ {len(created_orders)} órdenes creadas")
    return created_orders


def create_demo_reviews(app, orders, coverage=0.6):
    """Crear reviews para un % de los productos en órdenes entregadas"""
    print(f"\n⭐ Creando reviews demo (cobertura {coverage*100}%)...")
    
    # Obtener solo órdenes entregadas
    delivered_orders = [o for o in orders if o.status == 'delivered']
    
    if not delivered_orders:
        print("  ⚠️  No hay órdenes entregadas para dejar reviews")
        return []
    
    created_reviews = []
    reviewed_combinations = set()  # Para evitar duplicados (user_id, product_id)
    
    for order in delivered_orders:
        order_items = OrderItem.query.filter_by(order_id=order.id).all()
        
        for item in order_items:
            # Solo crear review con probabilidad de 'coverage'
            if random.random() > coverage:
                continue
            
            # Evitar duplicados
            key = (order.user_id, item.product_id)
            if key in reviewed_combinations:
                continue
            reviewed_combinations.add(key)
            
            # Generar rating (más peso en 4-5 estrellas)
            rating = random.choices(
                [5, 4, 3, 2, 1],
                weights=[40, 35, 15, 7, 3]  # Distribución realista
            )[0]
            
            # Fecha de review (días después de la orden)
            days_after_order = random.randint(1, 14)
            review_date = order.created_at + timedelta(days=days_after_order)
            
            # Crear review
            review = Review(
                product_id=item.product_id,
                user_id=order.user_id,
                order_id=order.id,
                rating=rating,
                title=random.choice(REVIEW_TITLES[rating]),
                comment=random.choice(REVIEW_COMMENTS[rating]),
                is_verified_purchase=True,
                created_at=review_date
            )
            
            db.session.add(review)
            created_reviews.append(review)
    
    db.session.commit()
    print(f"✅ {len(created_reviews)} reviews creadas")
    return created_reviews


def print_statistics(app):
    """Mostrar estadísticas finales"""
    print("\n" + "="*60)
    print("📊 ESTADÍSTICAS FINALES")
    print("="*60)
    
    total_users = User.query.count()
    total_orders = Order.query.count()
    total_reviews = Review.query.count()
    total_products = Product.query.count()
    
    products_with_reviews = db.session.query(Product.id).join(Review).distinct().count()
    
    print(f"👥 Usuarios totales: {total_users}")
    print(f"📦 Órdenes totales: {total_orders}")
    print(f"⭐ Reviews totales: {total_reviews}")
    print(f"📦 Productos totales: {total_products}")
    print(f"📊 Productos con reviews: {products_with_reviews}/{total_products} ({products_with_reviews/total_products*100:.1f}%)")
    
    # Top 5 productos con más reviews
    print("\n🏆 Top 5 productos con más reviews:")
    from sqlalchemy import func
    top_products = db.session.query(
        Product.name,
        func.count(Review.id).label('review_count'),
        func.avg(Review.rating).label('avg_rating')
    ).join(Review).group_by(Product.id).order_by(func.count(Review.id).desc()).limit(5).all()
    
    for i, (name, count, avg_rating) in enumerate(top_products, 1):
        stars = "⭐" * int(round(avg_rating))
        print(f"  {i}. {name}: {count} reviews ({avg_rating:.1f} {stars})")
    
    print("="*60)


def main():
    """Función principal"""
    print("\n" + "="*60)
    print("🌱 BLITZSHOP - SEED SCRIPT DE DEMO DATA")
    print("="*60)
    print("\nEste script creará:")
    print("  • 15 usuarios demo con nombres realistas")
    print("  • ~40 órdenes aleatorias")
    print("  • ~25-35 reviews con comentarios variados")
    print("  • Fechas distribuidas en los últimos 3 meses")
    print("\n⚠️  Esto NO borrará datos existentes.")
    
    response = input("\n¿Continuar? (s/n): ").strip().lower()
    if response != 's':
        print("❌ Cancelado por el usuario")
        return
    
    app = create_app()
    
    with app.app_context():
        # 1. Crear usuarios
        users = create_demo_users(app)
        
        # 2. Crear órdenes
        orders = create_demo_orders(app, users, num_orders=40)
        
        # 3. Crear reviews
        reviews = create_demo_reviews(app, orders, coverage=0.65)
        
        # 4. Mostrar estadísticas
        print_statistics(app)
    
    print("\n✅ ¡Seed completado exitosamente!")
    print("💡 Tip: Ejecuta este script cada vez que resetees la BD para tener datos demo")


if __name__ == "__main__":
    main()