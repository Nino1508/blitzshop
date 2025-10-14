from app import db
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import func

class Invoice(db.Model):
    __tablename__ = 'invoices'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(20), unique=True, nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Dates
    issue_date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    due_date = db.Column(db.DateTime)
    
    # Amounts (stored as Decimal for precision)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    tax_rate = db.Column(db.Numeric(5, 2), default=Decimal('21.00'))  # Default 21% for Spain
    tax_amount = db.Column(db.Numeric(10, 2), nullable=False)
    shipping_cost = db.Column(db.Numeric(10, 2), default=Decimal('0.00'))
    discount_amount = db.Column(db.Numeric(10, 2), default=Decimal('0.00'))
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    
    # Status
    status = db.Column(db.String(20), default='pending')  # pending, paid, cancelled, refunded
    payment_method = db.Column(db.String(50))
    payment_date = db.Column(db.DateTime)
    
    # Billing Information (denormalized for historical accuracy)
    billing_name = db.Column(db.String(100), nullable=False)
    billing_email = db.Column(db.String(100), nullable=False)
    billing_phone = db.Column(db.String(20))
    billing_address = db.Column(db.String(200))
    billing_city = db.Column(db.String(100))
    billing_state = db.Column(db.String(100))
    billing_postal_code = db.Column(db.String(20))
    billing_country = db.Column(db.String(2), default='ES')  # ISO country code
    
    # Company Information (configurable)
    company_name = db.Column(db.String(100))
    company_tax_id = db.Column(db.String(50))  # CIF/NIF for Spain, RUT for Chile
    company_address = db.Column(db.String(200))
    company_city = db.Column(db.String(100))
    company_postal_code = db.Column(db.String(20))
    company_country = db.Column(db.String(2), default='ES')
    company_email = db.Column(db.String(100))
    company_phone = db.Column(db.String(20))
    
    # Additional fields
    currency = db.Column(db.String(3), default='EUR')  # EUR, CLP, USD, etc.
    notes = db.Column(db.Text)
    terms_conditions = db.Column(db.Text)
    
    # PDF storage
    pdf_url = db.Column(db.String(500))  # URL to stored PDF
    pdf_generated_at = db.Column(db.DateTime)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    order = db.relationship('Order', backref='invoices', lazy=True)
    user = db.relationship('User', backref='invoices', lazy=True)
    
    @staticmethod
    def generate_invoice_number(prefix='INV'):
        """
        Generate sequential invoice number with format: INV-2025-00001
        """
        current_year = datetime.now(timezone.utc).year
        
        # Get the last invoice number for current year
        last_invoice = db.session.query(Invoice).filter(
            Invoice.invoice_number.like(f'{prefix}-{current_year}-%')
        ).order_by(Invoice.id.desc()).first()
        
        if last_invoice:
            # Extract the sequential number and increment
            last_number = int(last_invoice.invoice_number.split('-')[-1])
            new_number = last_number + 1
        else:
            # First invoice of the year
            new_number = 1
        
        return f"{prefix}-{current_year}-{new_number:05d}"
    
    @staticmethod
    def calculate_totals(order, tax_rate=21, shipping_cost=0, discount_amount=0):
        """
        Calculate invoice totals from order
        """
        subtotal = Decimal('0')
        
        # Calculate subtotal from order items
        for item in order.items:
            item_total = Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            subtotal += item_total
        
        # Calculate tax
        tax_rate_decimal = Decimal(str(tax_rate)) / Decimal('100')
        tax_amount = subtotal * tax_rate_decimal
        
        # Calculate total
        total = subtotal + tax_amount + Decimal(str(shipping_cost)) - Decimal(str(discount_amount))
        
        return {
            'subtotal': subtotal,
            'tax_amount': tax_amount,
            'total_amount': total
        }
    
    def to_dict(self):
        """Convert invoice to dictionary for JSON response"""
        return {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'order_id': self.order_id,
            'user_id': self.user_id,
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'subtotal': float(self.subtotal),
            'tax_rate': float(self.tax_rate),
            'tax_amount': float(self.tax_amount),
            'shipping_cost': float(self.shipping_cost),
            'discount_amount': float(self.discount_amount),
            'total_amount': float(self.total_amount),
            'status': self.status,
            'payment_method': self.payment_method,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'billing': {
                'name': self.billing_name,
                'email': self.billing_email,
                'phone': self.billing_phone,
                'address': self.billing_address,
                'city': self.billing_city,
                'state': self.billing_state,
                'postal_code': self.billing_postal_code,
                'country': self.billing_country
            },
            'company': {
                'name': self.company_name,
                'tax_id': self.company_tax_id,
                'address': self.company_address,
                'city': self.company_city,
                'postal_code': self.company_postal_code,
                'country': self.company_country,
                'email': self.company_email,
                'phone': self.company_phone
            },
            'currency': self.currency,
            'notes': self.notes,
            'pdf_url': self.pdf_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class InvoiceSettings(db.Model):
    """Global invoice settings for the company"""
    __tablename__ = 'invoice_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Company defaults
    company_name = db.Column(db.String(100), nullable=False)
    company_tax_id = db.Column(db.String(50), nullable=False)
    company_address = db.Column(db.String(200), nullable=False)
    company_city = db.Column(db.String(100), nullable=False)
    company_postal_code = db.Column(db.String(20), nullable=False)
    company_country = db.Column(db.String(2), default='ES')
    company_email = db.Column(db.String(100), nullable=False)
    company_phone = db.Column(db.String(20))
    company_website = db.Column(db.String(200))
    
    # Invoice defaults
    invoice_prefix = db.Column(db.String(10), default='INV')
    default_currency = db.Column(db.String(3), default='EUR')
    default_tax_rate = db.Column(db.Numeric(5, 2), default=Decimal('21.00'))
    payment_terms_days = db.Column(db.Integer, default=30)
    
    # Legal texts
    terms_conditions = db.Column(db.Text)
    footer_text = db.Column(db.Text)
    
    # Bank information (optional)
    bank_name = db.Column(db.String(100))
    bank_account = db.Column(db.String(50))
    bank_iban = db.Column(db.String(50))
    bank_swift = db.Column(db.String(20))
    
    # Logo
    logo_url = db.Column(db.String(500))
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @staticmethod
    def get_settings():
        """Get or create default settings"""
        settings = db.session.query(InvoiceSettings).first()
        if not settings:
            # Create default settings
            settings = InvoiceSettings(
                company_name='BlitzShop Demo Company',
                company_tax_id='B12345678',
                company_address='Calle Principal 123',
                company_city='Madrid',
                company_postal_code='28001',
                company_country='ES',
                company_email='invoices@blitzshop.com',
                company_phone='+34 900 000 000',
                terms_conditions='Payment due within 30 days. Late payments subject to 2% monthly interest.',
                footer_text='Thank you for your business!'
            )
            db.session.add(settings)
            db.session.commit()
        return settings
    
    def to_dict(self):
        """Convert settings to dictionary"""
        return {
            'company_name': self.company_name,
            'company_tax_id': self.company_tax_id,
            'company_address': self.company_address,
            'company_city': self.company_city,
            'company_postal_code': self.company_postal_code,
            'company_country': self.company_country,
            'company_email': self.company_email,
            'company_phone': self.company_phone,
            'company_website': self.company_website,
            'invoice_prefix': self.invoice_prefix,
            'default_currency': self.default_currency,
            'default_tax_rate': float(self.default_tax_rate),
            'payment_terms_days': self.payment_terms_days,
            'terms_conditions': self.terms_conditions,
            'footer_text': self.footer_text,
            'bank_name': self.bank_name,
            'bank_account': self.bank_account,
            'bank_iban': self.bank_iban,
            'bank_swift': self.bank_swift,
            'logo_url': self.logo_url
        }