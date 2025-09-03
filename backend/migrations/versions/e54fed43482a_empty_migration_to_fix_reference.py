"""Empty migration to fix reference

Revision ID: e54fed43482a
Revises: 
Create Date: 2025-09-03 22:27:24.110615

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e54fed43482a'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('address', sa.String(200), nullable=True))
    op.add_column('users', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('state', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('postal_code', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('country', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('company_name', sa.String(200), nullable=True))
    op.add_column('users', sa.Column('tax_id', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('billing_address', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('shipping_address', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('users', 'shipping_address')
    op.drop_column('users', 'billing_address')
    op.drop_column('users', 'tax_id')
    op.drop_column('users', 'company_name')
    op.drop_column('users', 'country')
    op.drop_column('users', 'postal_code')
    op.drop_column('users', 'state')
    op.drop_column('users', 'city')
    op.drop_column('users', 'address')
    op.drop_column('users', 'date_of_birth')
    op.drop_column('users', 'phone')