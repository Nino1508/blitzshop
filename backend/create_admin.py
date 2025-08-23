import os
from app import create_app, db
from app.models.user import User

def create_admin():
    app = create_app()
    
    with app.app_context():
        # Datos exactos de tu admin local
        admin_email = "admin@example.com"
        admin_username = "Admin"
        # Password hash de "admin123" que ya tienes
        password_hash = "scrypt:32768:8:1$IaNWB9eqW76zIvd5$18207d273efe979409df5203b88d944209c1a42c770962d222645a2e7870cb1cccdfdd79ad59349dd2b251941df98a95e17de549901d46405c53df29dcaf3d1f"
        
        existing = User.query.filter_by(email=admin_email).first()
        
        if existing:
            existing.is_admin = True
            existing.password_hash = password_hash
            db.session.commit()
            print(f"✅ Usuario actualizado a admin: {admin_email}")
        else:
            admin = User(
                username=admin_username,
                email=admin_email,
                password_hash=password_hash,
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
            print(f"✅ Admin migrado: {admin_email}")
        
        print(f"📧 Email: {admin_email}")
        print(f"🔑 Password: admin123")
        print("✅ Mismas credenciales que en desarrollo")

if __name__ == "__main__":
    create_admin()