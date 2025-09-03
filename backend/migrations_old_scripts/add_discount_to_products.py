"""
Migration script to add discount_percentage to products table
Run with: python migrations/add_discount_to_products.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Añadir columna discount_percentage
        with db.engine.connect() as conn:
            conn.execute(text('ALTER TABLE products ADD COLUMN discount_percentage INTEGER DEFAULT 0'))
            conn.commit()
            print("✅ Column discount_percentage added to products table")
            
    except Exception as e:
        if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
            print("⚠️ Column discount_percentage already exists")
        else:
            print(f"❌ Error: {e}")
            
    # Verificar que la columna se añadió
    try:
        with db.engine.connect() as conn:
            result = conn.execute(text("SELECT discount_percentage FROM products LIMIT 1"))
            print("✅ Column verified - discount_percentage exists in products table")
    except Exception as e:
        print(f"❌ Column verification failed: {e}")