from flask import Blueprint, request, jsonify, send_file, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.invoice import Invoice, InvoiceSettings
from app.models.order import Order
from app.models.user import User
from app.routes.admin import admin_required
from datetime import datetime, timedelta
from decimal import Decimal
import logging
from time import perf_counter
import os
from io import BytesIO

# Para generación de PDF (instalar: pip install reportlab)
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    logging.warning("ReportLab not installed. PDF generation disabled.")

logger = logging.getLogger(__name__)
invoices_bp = Blueprint('invoices', __name__)

# ==================== PUBLIC ROUTES ====================

@invoices_bp.route('/api/invoices', methods=['GET'])
@jwt_required()
def get_user_invoices():
    """Get all invoices for current user"""
    start_time = perf_counter()
    try:
        user_id = get_jwt_identity()
        
        # Pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Query user's invoices
        query = Invoice.query.filter_by(user_id=user_id).order_by(Invoice.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        invoices = [invoice.to_dict() for invoice in pagination.items]
        
        elapsed = perf_counter() - start_time
        logger.info(f"Retrieved {len(invoices)} invoices for user {user_id} in {elapsed:.3f}s")
        
        return jsonify({
            'invoices': invoices,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user invoices: {str(e)}")
        return jsonify({'error': 'Failed to retrieve invoices'}), 500


@invoices_bp.route('/api/invoices/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_invoice(invoice_id):
    """Get specific invoice (users can only see their own)"""
    start_time = perf_counter()
    try:
        user_id = get_jwt_identity()
        invoice = Invoice.query.get(invoice_id)
        
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Check if user owns this invoice (admins can see all)
        user = User.query.get(user_id)
        if invoice.user_id != user_id and not user.is_admin:
            return jsonify({'error': 'Unauthorized access'}), 403
        
        elapsed = perf_counter() - start_time
        logger.info(f"Retrieved invoice {invoice_id} in {elapsed:.3f}s")
        
        return jsonify(invoice.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error getting invoice {invoice_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve invoice'}), 500

# OPTIONS handler para CORS en descarga de admin
@invoices_bp.route('/api/admin/invoices/<int:invoice_id>/download', methods=['OPTIONS'])
def download_invoice_admin_options(invoice_id):
    response = make_response('', 200)
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    return response

@invoices_bp.route('/api/invoices/<int:invoice_id>/download', methods=['GET'])
@jwt_required()
def download_invoice(invoice_id):
    """Download invoice as PDF"""
    if not PDF_SUPPORT:
        return jsonify({'error': 'PDF generation not available'}), 503
    
    start_time = perf_counter()
    try:
        user_id = get_jwt_identity()
        invoice = Invoice.query.get(invoice_id)
        
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Check permissions
        user = User.query.get(user_id)
        if invoice.user_id != user_id and not user.is_admin:
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Generate PDF
        pdf_buffer = generate_invoice_pdf(invoice)
        
        elapsed = perf_counter() - start_time
        logger.info(f"Generated PDF for invoice {invoice_id} in {elapsed:.3f}s")
        
        response = make_response(pdf_buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=invoice_{invoice.invoice_number}.pdf'
        return response
        
    except Exception as e:
        logger.error(f"Error downloading invoice {invoice_id}: {str(e)}")
        return jsonify({'error': 'Failed to generate PDF'}), 500

# Duplicate route for admin download (mantiene compatibilidad con frontend)
@invoices_bp.route('/api/admin/invoices/<int:invoice_id>/download', methods=['GET'])
@jwt_required()
@admin_required
def download_invoice_admin(invoice_id):
    """Admin download invoice as PDF"""
    if not PDF_SUPPORT:
        return jsonify({'error': 'PDF generation not available'}), 503
    
    start_time = perf_counter()
    try:
        invoice = Invoice.query.get(invoice_id)
        
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Generate PDF
        pdf_buffer = generate_invoice_pdf(invoice)
        
        elapsed = perf_counter() - start_time
        logger.info(f"Admin generated PDF for invoice {invoice_id} in {elapsed:.3f}s")
        
        response = make_response(pdf_buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=invoice_{invoice.invoice_number}.pdf'
        return response
        
    except Exception as e:
        logger.error(f"Error downloading invoice {invoice_id}: {str(e)}")
        return jsonify({'error': 'Failed to generate PDF'}), 500


# ==================== ADMIN ROUTES ====================

@invoices_bp.route('/api/admin/invoices', methods=['GET'])
@jwt_required()
@admin_required
def admin_get_all_invoices():
    """Admin: Get all invoices with filters"""
    start_time = perf_counter()
    try:
        # Pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Filters
        status = request.args.get('status')
        user_id = request.args.get('user_id', type=int)
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        # Build query
        query = Invoice.query
        
        if status:
            query = query.filter_by(status=status)
        if user_id:
            query = query.filter_by(user_id=user_id)
        if from_date:
            query = query.filter(Invoice.issue_date >= datetime.fromisoformat(from_date))
        if to_date:
            query = query.filter(Invoice.issue_date <= datetime.fromisoformat(to_date))
        
        query = query.order_by(Invoice.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        invoices = [invoice.to_dict() for invoice in pagination.items]
        
        # Calculate totals
        total_amount = db.session.query(db.func.sum(Invoice.total_amount)).scalar() or 0
        
        elapsed = perf_counter() - start_time
        logger.info(f"Admin retrieved {len(invoices)} invoices in {elapsed:.3f}s")
        
        return jsonify({
            'invoices': invoices,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'stats': {
                'total_invoiced': float(total_amount),
                'total_invoices': pagination.total
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in admin get invoices: {str(e)}")
        return jsonify({'error': 'Failed to retrieve invoices'}), 500


@invoices_bp.route('/api/admin/invoices/create/<int:order_id>', methods=['POST'])
@jwt_required()
@admin_required
def admin_create_invoice(order_id):
    """Admin: Create invoice from order"""
    start_time = perf_counter()
    try:
        # Get order
        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Check if invoice already exists
        existing_invoice = Invoice.query.filter_by(order_id=order_id).first()
        if existing_invoice:
            return jsonify({'error': 'Invoice already exists for this order'}), 400
        
        # Get invoice settings
        settings = InvoiceSettings.get_settings()
        
        # Get request data
        data = request.get_json() or {}
        
        # Calculate totals
        totals = Invoice.calculate_totals(
            order,
            tax_rate=data.get('tax_rate', float(settings.default_tax_rate)),
            shipping_cost=data.get('shipping_cost', 0),
            discount_amount=data.get('discount_amount', 0)
        )
        
        # Create invoice
        invoice = Invoice(
            invoice_number=Invoice.generate_invoice_number(settings.invoice_prefix),
            order_id=order_id,
            user_id=order.user_id,
            issue_date=datetime.utcnow(),
            due_date=datetime.utcnow() + timedelta(days=settings.payment_terms_days),
            subtotal=totals['subtotal'],
            tax_rate=Decimal(str(data.get('tax_rate', float(settings.default_tax_rate)))),
            tax_amount=totals['tax_amount'],
            shipping_cost=Decimal(str(data.get('shipping_cost', 0))),
            discount_amount=Decimal(str(data.get('discount_amount', 0))),
            total_amount=totals['total_amount'],
            status='pending',
            payment_method='stripe',
            # Billing info from user
            billing_name=order.user.username,
            billing_email=order.user.email,
            billing_phone=data.get('billing_phone', ''),
            billing_address=data.get('billing_address', order.shipping_address or ''),
            billing_city=data.get('billing_city', ''),
            billing_state=data.get('billing_state', ''),
            billing_postal_code=data.get('billing_postal_code', ''),
            billing_country=data.get('billing_country', settings.company_country),
            # Company info from settings
            company_name=settings.company_name,
            company_tax_id=settings.company_tax_id,
            company_address=settings.company_address,
            company_city=settings.company_city,
            company_postal_code=settings.company_postal_code,
            company_country=settings.company_country,
            company_email=settings.company_email,
            company_phone=settings.company_phone,
            # Additional
            currency=settings.default_currency,
            notes=data.get('notes', ''),
            terms_conditions=settings.terms_conditions
        )
        
        db.session.add(invoice)
        db.session.commit()
        
        elapsed = perf_counter() - start_time
        logger.info(f"Created invoice {invoice.invoice_number} for order {order_id} in {elapsed:.3f}s")
        
        return jsonify({
            'message': 'Invoice created successfully',
            'invoice': invoice.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating invoice: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to create invoice'}), 500


@invoices_bp.route('/api/admin/invoices/<int:invoice_id>', methods=['PUT'])
@jwt_required()
@admin_required
def admin_update_invoice(invoice_id):
    """Admin: Update invoice status or details"""
    start_time = perf_counter()
    try:
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        if 'status' in data:
            invoice.status = data['status']
            if data['status'] == 'paid':
                invoice.payment_date = datetime.utcnow()
        
        if 'notes' in data:
            invoice.notes = data['notes']
        
        if 'payment_method' in data:
            invoice.payment_method = data['payment_method']
        
        invoice.updated_at = datetime.utcnow()
        db.session.commit()
        
        elapsed = perf_counter() - start_time
        logger.info(f"Updated invoice {invoice_id} in {elapsed:.3f}s")
        
        return jsonify({
            'message': 'Invoice updated successfully',
            'invoice': invoice.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating invoice {invoice_id}: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update invoice'}), 500


@invoices_bp.route('/api/admin/invoices/<int:invoice_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def admin_delete_invoice(invoice_id):
    """Admin: Delete invoice (soft delete by changing status)"""
    start_time = perf_counter()
    try:
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Soft delete - just change status
        invoice.status = 'cancelled'
        invoice.updated_at = datetime.utcnow()
        db.session.commit()
        
        elapsed = perf_counter() - start_time
        logger.info(f"Cancelled invoice {invoice_id} in {elapsed:.3f}s")
        
        return jsonify({'message': 'Invoice cancelled successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting invoice {invoice_id}: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to delete invoice'}), 500


# ==================== SETTINGS ROUTES ====================

@invoices_bp.route('/api/admin/invoice-settings', methods=['GET'])
@jwt_required()
@admin_required
def get_invoice_settings():
    """Get invoice settings"""
    try:
        settings = InvoiceSettings.get_settings()
        return jsonify(settings.to_dict()), 200
    except Exception as e:
        logger.error(f"Error getting invoice settings: {str(e)}")
        return jsonify({'error': 'Failed to get settings'}), 500


@invoices_bp.route('/api/admin/invoice-settings', methods=['PUT'])
@jwt_required()
@admin_required
def update_invoice_settings():
    """Update invoice settings"""
    try:
        settings = InvoiceSettings.get_settings()
        data = request.get_json()
        
        # Update fields
        for field in ['company_name', 'company_tax_id', 'company_address', 
                      'company_city', 'company_postal_code', 'company_country',
                      'company_email', 'company_phone', 'company_website',
                      'invoice_prefix', 'default_currency', 'payment_terms_days',
                      'terms_conditions', 'footer_text', 'bank_name', 
                      'bank_account', 'bank_iban', 'bank_swift', 'logo_url']:
            if field in data:
                if field == 'default_tax_rate':
                    setattr(settings, field, Decimal(str(data[field])))
                else:
                    setattr(settings, field, data[field])
        
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info("Invoice settings updated successfully")
        return jsonify({
            'message': 'Settings updated successfully',
            'settings': settings.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating invoice settings: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update settings'}), 500


# ==================== HELPER FUNCTIONS ====================

def generate_invoice_pdf(invoice):
    """Generate PDF for invoice"""
    if not PDF_SUPPORT:
        raise Exception("PDF generation not available")
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#2c3e50'),
        alignment=TA_CENTER
    )
    
    # Title
    story.append(Paragraph("INVOICE", title_style))
    story.append(Spacer(1, 20))
    
    # Invoice details
    invoice_data = [
        ['Invoice Number:', invoice.invoice_number],
        ['Date:', invoice.issue_date.strftime('%Y-%m-%d')],
        ['Due Date:', invoice.due_date.strftime('%Y-%m-%d') if invoice.due_date else 'N/A'],
        ['Status:', invoice.status.upper()]
    ]
    
    invoice_table = Table(invoice_data, colWidths=[100, 200])
    invoice_table.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))
    story.append(invoice_table)
    story.append(Spacer(1, 20))
    
    # Company and billing info
    company_billing_data = [
        ['FROM:', 'BILL TO:'],
        [invoice.company_name or 'Company Name', invoice.billing_name],
        [invoice.company_address or '', invoice.billing_address or ''],
        [f"{invoice.company_city}, {invoice.company_postal_code}", 
         f"{invoice.billing_city}, {invoice.billing_postal_code}" if invoice.billing_city else ''],
        [invoice.company_email or '', invoice.billing_email],
    ]
    
    company_billing_table = Table(company_billing_data, colWidths=[250, 250])
    company_billing_table.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(company_billing_table)
    story.append(Spacer(1, 30))
    
    # Order items from the associated order - CORREGIDO
    if invoice.order and invoice.order.items:
        items_data = [['Description', 'Qty', 'Price', 'Total']]
        for item in invoice.order.items:
            items_data.append([
                item.product.name if item.product else 'Product',
                str(item.quantity),
                f"{invoice.currency} {item.unit_price:.2f}",  # CORREGIDO
                f"{invoice.currency} {(item.quantity * item.unit_price):.2f}"  # CORREGIDO
            ])
        
        items_table = Table(items_data, colWidths=[250, 50, 100, 100])
        items_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecf0f1')),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 20))
    
    # Totals
    totals_data = [
        ['Subtotal:', f"{invoice.currency} {invoice.subtotal:.2f}"],
        [f'Tax ({invoice.tax_rate}%):', f"{invoice.currency} {invoice.tax_amount:.2f}"],
        ['Shipping:', f"{invoice.currency} {invoice.shipping_cost:.2f}"],
    ]
    
    if invoice.discount_amount > 0:
        totals_data.append(['Discount:', f"-{invoice.currency} {invoice.discount_amount:.2f}"])
    
    totals_data.append(['TOTAL:', f"{invoice.currency} {invoice.total_amount:.2f}"])
    
    totals_table = Table(totals_data, colWidths=[400, 100])
    totals_table.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black),
    ]))
    story.append(totals_table)
    
    # Notes and terms
    if invoice.notes:
        story.append(Spacer(1, 30))
        story.append(Paragraph("Notes:", styles['Heading3']))
        story.append(Paragraph(invoice.notes, styles['Normal']))
    
    if invoice.terms_conditions:
        story.append(Spacer(1, 20))
        story.append(Paragraph("Terms & Conditions:", styles['Heading3']))
        story.append(Paragraph(invoice.terms_conditions, styles['Normal']))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer