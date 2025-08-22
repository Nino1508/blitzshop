"""
Script para crear productos VARIADOS
Categorías: Electrónica, Hogar, Deportes, Ropa, Oficina, Herramientas
INCLUYE MOCCAMASTER - Sin alimentos, belleza, juguetes ni libros
"""

from app import create_app, db
from app.models.product import Product

def create_test_products():
    app = create_app()
    
    with app.app_context():
        # Verificar si ya hay productos
        if Product.query.count() > 0:
            print(f"Ya hay {Product.query.count()} productos en la base de datos")
            return
        
        products = [
            # ====== CAFÉ/COCINA - TU MOCCAMASTER ======
            {
                'name': 'Moccamaster KBG Select',
                'description': 'Premium Dutch coffee maker, handmade in Netherlands, SCAA certified, 10-cup capacity',
                'price': 329.99,
                'stock': 8,
                'category': 'Kitchen',
                'image_url': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80'  # Cafetera premium real
            },
            
            # ====== ELECTRÓNICA ======
            {
                'name': 'Sony Alpha A7 III',
                'description': 'Full-frame mirrorless camera, 24.2MP, 4K HDR video, 5-axis stabilization',
                'price': 1799.99,
                'stock': 5,
                'category': 'Cameras',
                'image_url': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80'
            },
            {
                'name': 'Mechanical Keyboard RGB',
                'description': 'Cherry MX switches, aluminum frame, RGB backlighting, tenkeyless design',
                'price': 149.99,
                'stock': 20,
                'category': 'Electronics',
                'image_url': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80'
            },
            {
                'name': 'Bose SoundLink Revolve+',
                'description': '360° sound, water-resistant, 16-hour battery, portable handle',
                'price': 299.99,
                'stock': 15,
                'category': 'Audio',
                'image_url': 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80'
            },
            
            # ====== ROPA Y ACCESORIOS ======
            {
                'name': 'Patagonia Down Jacket',
                'description': 'Recycled down insulation, windproof, water-repellent, packable',
                'price': 279.99,
                'stock': 12,
                'category': 'Clothing',
                'image_url': 'https://images.unsplash.com/photo-1566479179817-0ddb5fa87cd9?w=600&q=80'
            },
            {
                'name': 'Levi\'s 501 Original Jeans',
                'description': 'Classic straight fit, button fly, 100% cotton denim',
                'price': 89.99,
                'stock': 30,
                'category': 'Clothing',
                'image_url': 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&q=80'
            },
            {
                'name': 'Fjällräven Kånken Backpack',
                'description': 'Classic Swedish design, laptop compartment, water-resistant vinyl',
                'price': 95.00,
                'stock': 25,
                'category': 'Bags',
                'image_url': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80'
            },
            
            # ====== DEPORTES ======
            {
                'name': 'Garmin Forerunner 945',
                'description': 'GPS running watch, music, maps, performance monitoring',
                'price': 549.99,
                'stock': 10,
                'category': 'Sports',
                'image_url': 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&q=80'
            },
            {
                'name': 'Manduka PRO Yoga Mat',
                'description': 'Professional 6mm thick mat, lifetime guarantee, closed-cell surface',
                'price': 120.00,
                'stock': 18,
                'category': 'Sports',
                'image_url': 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&q=80'
            },
            {
                'name': 'Hydro Flask 32oz',
                'description': 'Insulated water bottle, keeps cold 24hrs, hot 12hrs, flex cap',
                'price': 44.95,
                'stock': 40,
                'category': 'Sports',
                'image_url': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80'
            },
            
            # ====== HOGAR ======
            {
                'name': 'Philips Hue Starter Kit',
                'description': 'Smart lighting, 3 color bulbs + bridge, voice control compatible',
                'price': 199.99,
                'stock': 14,
                'category': 'Home',
                'image_url': 'https://images.unsplash.com/photo-1565636192335-95a1e2b3a4e4?w=600&q=80'
            },
            {
                'name': 'Dyson V15 Detect',
                'description': 'Cordless vacuum, laser dust detection, 60min runtime, HEPA filtration',
                'price': 749.99,
                'stock': 7,
                'category': 'Home',
                'image_url': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&q=80'  # Aspiradora moderna
            },
            {
                'name': 'Herman Miller Aeron Chair',
                'description': 'Ergonomic office chair, mesh back, adjustable lumbar support',
                'price': 1395.00,
                'stock': 4,
                'category': 'Furniture',
                'image_url': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80'  # Silla premium real
            },
            
            # ====== OFICINA ======
            {
                'name': 'iPad Pro 12.9"',
                'description': 'M2 chip, Liquid Retina XDR display, 128GB, supports Apple Pencil',
                'price': 1099.00,
                'stock': 9,
                'category': 'Tablets',
                'image_url': 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80'
            },
            {
                'name': 'Brother Laser Printer',
                'description': 'Wireless monochrome printer, duplex printing, 32ppm',
                'price': 199.99,
                'stock': 16,
                'category': 'Office',
                'image_url': 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&q=80'
            },
            {
                'name': 'Standing Desk Converter',
                'description': 'Adjustable height, dual monitor support, keyboard tray',
                'price': 299.99,
                'stock': 11,
                'category': 'Office',
                'image_url': 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=600&q=80'
            },
            
            # ====== HERRAMIENTAS ======
            {
                'name': 'DeWalt 20V Drill Set',
                'description': 'Cordless drill/driver, 2 batteries, charger, 30pc bit set',
                'price': 169.00,
                'stock': 13,
                'category': 'Tools',
                'image_url': 'https://images.unsplash.com/photo-1572981511192-ed3a033db8dc?w=600&q=80'  # Taladro real
            },
            {
                'name': 'Leatherman Wave+',
                'description': '18 tools in one, premium steel, 25-year warranty',
                'price': 109.95,
                'stock': 22,
                'category': 'Tools',
                'image_url': 'https://images.unsplash.com/photo-1609205807490-b18f9e5c7f5a?w=600&q=80'
            },
            
            # ====== TECH ACCESSORIES ======
            {
                'name': 'Anker PowerBank 20000mAh',
                'description': 'Fast charging, USB-C PD, charge 3 devices simultaneously',
                'price': 59.99,
                'stock': 35,
                'category': 'Accessories',
                'image_url': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80'
            },
            {
                'name': 'Samsung T7 SSD 1TB',
                'description': 'Portable SSD, 1050MB/s transfer speed, shock resistant',
                'price': 109.99,
                'stock': 24,
                'category': 'Storage',
                'image_url': 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&q=80'
            }
        ]
        
        # Crear productos
        for product_data in products:
            product = Product(**product_data)
            db.session.add(product)
            print(f"✅ Creando: {product_data['name']} - ${product_data['price']} ({product_data['category']})")
        
        db.session.commit()
        print(f"\n🎉 {len(products)} productos VARIADOS creados!")
        print("✅ Incluye tu Moccamaster KBG Select")
        print("✅ Categorías: Electrónica, Ropa, Hogar, Deportes, Oficina, Herramientas")
        print("✅ Ve a http://localhost:3000/products")

if __name__ == '__main__':
    create_test_products()