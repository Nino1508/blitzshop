import sqlite3
import psycopg2

# Conexión SQLite local
local_conn = sqlite3.connect('instance/ecommerce.db')
local_cur = local_conn.cursor()

# URL de Supabase
DATABASE_URL = "postgresql://postgres.lylazilkthskuyjtehsv:Chile2025_12@aws-1-eu-north-1.pooler.supabase.com:6543/postgres"
prod_conn = psycopg2.connect(DATABASE_URL)
prod_cur = prod_conn.cursor()

# Desactivar todos los productos existentes
prod_cur.execute("UPDATE products SET is_active = false")
print("Productos anteriores desactivados")

# Obtener productos locales
local_cur.execute("SELECT name, description, price, stock, category, image_url, is_active FROM products")
products = local_cur.fetchall()

# Actualizar o insertar
for product in products:
    # Convertir 0/1 a boolean
    is_active = bool(product[6])
    
    # Verificar si existe
    prod_cur.execute("SELECT id FROM products WHERE name = %s", (product[0],))
    existing = prod_cur.fetchone()
    
    if existing:
        # Actualizar existente
        prod_cur.execute("""
            UPDATE products 
            SET description=%s, price=%s, stock=%s, category=%s, image_url=%s, is_active=%s
            WHERE name=%s
        """, (product[1], product[2], product[3], product[4], product[5], is_active, product[0]))
    else:
        # Insertar nuevo
        prod_cur.execute("""
            INSERT INTO products (name, description, price, stock, category, image_url, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (product[0], product[1], product[2], product[3], product[4], product[5], is_active))

prod_conn.commit()
print(f"✅ {len(products)} productos sincronizados")

local_conn.close()
prod_conn.close()