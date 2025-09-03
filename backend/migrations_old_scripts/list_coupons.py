# backend/migrations/list_coupons.py
import os, sys
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app import create_app, db
from app.models.coupon import Coupon

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        total = Coupon.query.count()
        print(f"Total cupones: {total}")
        for c in Coupon.query.order_by(Coupon.id).all():
            print(f"- {c.code} | {c.discount_type} {c.discount_value} | activo={c.is_active}")
