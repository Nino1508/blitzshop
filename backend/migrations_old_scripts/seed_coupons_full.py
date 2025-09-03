# backend/migrations/seed_coupons_full.py
import os, sys
from datetime import datetime, timedelta
from urllib.parse import urlparse

# Asegura que backend/ esté en sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app import create_app, db
from app.models.coupon import Coupon

app = create_app()

SAMPLES = [
    dict(code="WELCOME10", description="10% discount (min €50)",
         discount_type="percentage", discount_value=10, min_purchase=50,
         usage_limit=100, usage_limit_per_user=1, max_discount=None, days=30, is_active=True),
    dict(code="SAVE5", description="€5 off (min €25)",
         discount_type="fixed", discount_value=5, min_purchase=25,
         usage_limit=200, usage_limit_per_user=3, max_discount=None, days=60, is_active=True),
    dict(code="BIGDEAL20", description="20% off (max €20, min €100)",
         discount_type="percentage", discount_value=20, min_purchase=100,
         usage_limit=100, usage_limit_per_user=2, max_discount=20, days=45, is_active=True),
    dict(code="FREESHIP", description="€10 off (min €75)",
         discount_type="fixed", discount_value=10, min_purchase=75,
         usage_limit=300, usage_limit_per_user=5, max_discount=None, days=90, is_active=True),
    dict(code="EXPIRED15", description="Expired test - 15% off",
         discount_type="percentage", discount_value=15, min_purchase=30,
         usage_limit=50, usage_limit_per_user=1, max_discount=None, days=-1, is_active=True),
]

def upsert(code, **kw):
    c = Coupon.query.filter_by(code=code).first()
    if not c:
        c = Coupon(code=code, **kw)
        db.session.add(c)

if __name__ == "__main__":
    with app.app_context():
        # Aviso claro de a qué BD estás apuntando
        url = str(db.engine.url)
        parsed = urlparse(url)
        print("🔎 Seeding en:", url)
        if "supabase" in (parsed.hostname or ""):
            print("🌍 CUIDADO: esto es una base en SUPABASE")

        created = 0
        for s in SAMPLES:
            exists = Coupon.query.filter_by(code=s["code"]).first()
            if exists:
                print(f"↷ Ya existía: {s['code']}")
                continue
            upsert(
                s["code"],
                description=s["description"],
                discount_type=s["discount_type"],
                discount_value=s["discount_value"],
                min_purchase=s["min_purchase"],
                usage_limit=s["usage_limit"],
                usage_limit_per_user=s["usage_limit_per_user"],
                max_discount=s["max_discount"],
                valid_from=datetime.utcnow() - timedelta(days=1),
                valid_until=datetime.utcnow() + timedelta(days=s["days"]),
                is_active=s["is_active"],
            )
            created += 1

        db.session.commit()
        print(f"✅ Seed completado. Nuevos creados: {created}")
