import os, sys
from urllib.parse import urlparse

# Aseguramos que "backend" está en sys.path
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)

from app import create_app, db

app = create_app()

with app.app_context():
    url = str(db.engine.url)
    parsed = urlparse(url)

    print("🔎 URL completa:", url)
    print("📡 Host:", parsed.hostname)
    print("🗄️  Base de datos:", parsed.path.lstrip('/'))
    print("👤 Usuario:", parsed.username)
    print("🚪 Puerto:", parsed.port)

    if parsed.hostname:
        if "supabase" in parsed.hostname:
            print("🌍 Estás conectado a una base en SUPABASE")
        elif parsed.hostname in ["localhost", "127.0.0.1"]:
            print("💻 Estás conectado a una base LOCAL")
        else:
            print("❓ Host desconocido:", parsed.hostname)
    else:
        print("⚠️ No se detectó host en la URL de la base de datos")
