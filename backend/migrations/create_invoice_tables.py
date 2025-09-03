# migrations/create_invoice_tables.py
from app import create_app, db
from app.models.invoice import Invoice, InvoiceSettings

def create_invoice_tables():
    """Create invoice-related tables in the database"""
    app = create_app()
    with app.app_context():
        try:
            print("Creating invoice tables...")

            # Crea todas las tablas conocidas por SQLAlchemy (incluye Invoice e InvoiceSettings)
            db.create_all()

            # Verificar tablas
            inspector = db.inspect(db.engine)
            tables = set(inspector.get_table_names())

            if 'invoices' in tables:
                print("✅ Invoice table created successfully")
            else:
                print("❌ Failed to create Invoice table")

            if 'invoice_settings' in tables:
                print("✅ InvoiceSettings table created successfully")
            else:
                print("❌ Failed to create InvoiceSettings table")

            # Crear settings por defecto si no existen
            settings = InvoiceSettings.query.first()
            if not settings:
                print("Creating default invoice settings...")
                default_settings = InvoiceSettings(
                    company_name='BlitzShop Demo Company',
                    company_tax_id='B12345678',
                    company_address='Calle Principal 123',
                    company_city='Madrid',
                    company_postal_code='28001',
                    company_country='ES',
                    company_email='invoices@blitzshop.com',
                    company_phone='+34 900 000 000',
                    company_website='https://blitzshop.netlify.app',
                    invoice_prefix='INV',
                    default_currency='EUR',
                    default_tax_rate=21.00,
                    payment_terms_days=30,
                    terms_conditions='Payment due within 30 days. Late payments subject to 2% monthly interest.',
                    footer_text='Thank you for your business!'
                )
                db.session.add(default_settings)
                db.session.commit()
                print("✅ Default invoice settings created")
            else:
                print("ℹ️ Invoice settings already exist")

            print("\n✅ Invoice system setup completed successfully!")
            return 0

        except Exception as e:
            print(f"❌ Error creating invoice tables: {str(e)}")
            db.session.rollback()
            return 1

if __name__ == "__main__":
    raise SystemExit(create_invoice_tables())
