# backend/migrate_products.py - Script para agregar nuevas columnas

from app import create_app, db
from sqlalchemy import text, inspect

def migrate_products():
    app = create_app()
    
    with app.app_context():
        try:
            # Verificar si las columnas ya existen
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('products')]
            print(f"📋 Current columns: {columns}")
            
            # Agregar columnas faltantes
            if 'stock_quantity' not in columns:
                with db.engine.connect() as conn:
                    conn.execute(text('ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0'))
                    conn.commit()
                print("✅ Added stock_quantity column")
            else:
                print("ℹ️ stock_quantity column already exists")
            
            if 'is_active' not in columns:
                with db.engine.connect() as conn:
                    conn.execute(text('ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT 1'))
                    conn.commit()
                print("✅ Added is_active column")
            else:
                print("ℹ️ is_active column already exists")
            
            if 'created_at' not in columns:
                with db.engine.connect() as conn:
                    conn.execute(text('ALTER TABLE products ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP'))
                    conn.commit()
                print("✅ Added created_at column")
            else:
                print("ℹ️ created_at column already exists")
            
            if 'updated_at' not in columns:
                with db.engine.connect() as conn:
                    conn.execute(text('ALTER TABLE products ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'))
                    conn.commit()
                print("✅ Added updated_at column")
            else:
                print("ℹ️ updated_at column already exists")
            
            # Actualizar productos existentes con valores por defecto
            with db.engine.connect() as conn:
                result = conn.execute(text('''
                    UPDATE products 
                    SET stock_quantity = COALESCE(stock_quantity, 50), 
                        is_active = COALESCE(is_active, 1),
                        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
                        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
                    WHERE stock_quantity IS NULL OR is_active IS NULL 
                       OR created_at IS NULL OR updated_at IS NULL
                '''))
                conn.commit()
                print(f"📝 Updated {result.rowcount} existing products")
            
            print("🎉 Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Migration error: {e}")
            db.session.rollback()

if __name__ == '__main__':
    migrate_products()