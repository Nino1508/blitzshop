# backend/migrations/check_tables.py
import os, sys
# Añade la carpeta "backend/" al sys.path para que "app" sea importable
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../backend
sys.path.insert(0, BASE_DIR)

from app import create_app, db
from sqlalchemy import inspect

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        insp = inspect(db.engine)
        tables = insp.get_table_names()
        print("📋 Tablas en la BD:", tables)
        print("¿Existe 'coupons'? ->", 'coupons' in tables)
