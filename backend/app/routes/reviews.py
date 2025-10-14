import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func

from app import db
from app.models.review import Review
from app.models.product import Product
from app.models.user import User
from app.models.order import Order, OrderItem

reviews_bp = Blueprint("reviews", __name__)
logger = logging.getLogger(__name__)


def error_response(status: int, error: str, message: str | None = None):
    payload = {"error": error}
    if message:
        payload["message"] = message
    return jsonify(payload), status


@reviews_bp.route("/products/<int:product_id>/reviews", methods=["GET"])
def get_product_reviews(product_id):
    """Obtener todas las reviews de un producto"""
    try:
        product = Product.query.get(product_id)
        if not product:
            return error_response(404, "not_found", "Product not found")
        
        # Pagination
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 10, type=int), 50)
        
        # Get reviews
        reviews_query = Review.query.filter_by(product_id=product_id).order_by(Review.created_at.desc())
        pagination = reviews_query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Calculate average rating
        avg_rating = db.session.query(func.avg(Review.rating)).filter(Review.product_id == product_id).scalar()
        total_reviews = db.session.query(func.count(Review.id)).filter(Review.product_id == product_id).scalar()
        
        return jsonify({
            "reviews": [review.to_dict() for review in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
            "average_rating": float(avg_rating) if avg_rating else 0,
            "total_reviews": total_reviews or 0
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting reviews: {str(e)}")
        return error_response(500, "server_error", "Error retrieving reviews")


@reviews_bp.route("/products/<int:product_id>/reviews", methods=["POST"])
@jwt_required()
def create_review(product_id):
    """Crear una nueva review para un producto"""
    try:
        current_user_id = get_jwt_identity()
        
        # Validate product exists
        product = Product.query.get(product_id)
        if not product:
            return error_response(404, "not_found", "Product not found")
        
        data = request.get_json()
        
        # Validate required fields
        if not data or "rating" not in data:
            return error_response(400, "bad_request", "Rating is required")
        
        rating = data.get("rating")
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            return error_response(400, "bad_request", "Rating must be between 1 and 5")
        
        # Check if user already reviewed this product
        existing_review = Review.query.filter_by(
            product_id=product_id,
            user_id=current_user_id
        ).first()
        
        if existing_review:
            return error_response(400, "already_reviewed", "You have already reviewed this product")
        
        # Check if user purchased this product
        order_id = data.get("order_id")
        is_verified = False
        
        if order_id:
            order = Order.query.filter_by(
                id=order_id,
                user_id=current_user_id
            ).first()
            
            if order:
                # Check if product is in this order
                order_item = OrderItem.query.filter_by(
                    order_id=order_id,
                    product_id=product_id
                ).first()
                
                if order_item:
                    is_verified = True
        
        # Create review
        review = Review(
            product_id=product_id,
            user_id=current_user_id,
            order_id=order_id if is_verified else None,
            rating=rating,
            title=data.get("title", "").strip()[:200],
            comment=data.get("comment", "").strip(),
            is_verified_purchase=is_verified
        )
        
        db.session.add(review)
        db.session.commit()
        
        logger.info(f"Review created: {review.id} for product {product_id} by user {current_user_id}")
        
        return jsonify({
            "message": "Review created successfully",
            "review": review.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating review: {str(e)}")
        return error_response(500, "server_error", "Error creating review")


@reviews_bp.route("/reviews/<int:review_id>", methods=["PUT"])
@jwt_required()
def update_review(review_id):
    """Actualizar una review existente"""
    try:
        current_user_id = get_jwt_identity()
        
        review = Review.query.get(review_id)
        if not review:
            return error_response(404, "not_found", "Review not found")
        
        # Check if user owns this review
        if review.user_id != current_user_id:
            return error_response(403, "forbidden", "You can only edit your own reviews")
        
        data = request.get_json()
        
        # Update rating if provided
        if "rating" in data:
            rating = data["rating"]
            if not isinstance(rating, int) or rating < 1 or rating > 5:
                return error_response(400, "bad_request", "Rating must be between 1 and 5")
            review.rating = rating
        
        # Update title if provided
        if "title" in data:
            review.title = data["title"].strip()[:200]
        
        # Update comment if provided
        if "comment" in data:
            review.comment = data["comment"].strip()
        
        db.session.commit()
        
        logger.info(f"Review updated: {review_id} by user {current_user_id}")
        
        return jsonify({
            "message": "Review updated successfully",
            "review": review.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating review: {str(e)}")
        return error_response(500, "server_error", "Error updating review")


@reviews_bp.route("/reviews/<int:review_id>", methods=["DELETE"])
@jwt_required()
def delete_review(review_id):
    """Eliminar una review"""
    try:
        current_user_id = get_jwt_identity()
        
        review = Review.query.get(review_id)
        if not review:
            return error_response(404, "not_found", "Review not found")
        
        # Check if user owns this review or is admin
        user = User.query.get(current_user_id)
        if review.user_id != current_user_id and not (user and user.role == 'admin'):
            return error_response(403, "forbidden", "You can only delete your own reviews")
        
        db.session.delete(review)
        db.session.commit()
        
        logger.info(f"Review deleted: {review_id} by user {current_user_id}")
        
        return jsonify({"message": "Review deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting review: {str(e)}")
        return error_response(500, "server_error", "Error deleting review")


@reviews_bp.route("/users/me/reviews", methods=["GET"])
@jwt_required()
def get_my_reviews():
    """Obtener todas las reviews del usuario actual"""
    try:
        current_user_id = get_jwt_identity()
        
        reviews = Review.query.filter_by(user_id=current_user_id).order_by(Review.created_at.desc()).all()
        
        return jsonify({
            "reviews": [review.to_dict() for review in reviews],
            "total": len(reviews)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user reviews: {str(e)}")
        return error_response(500, "server_error", "Error retrieving reviews")


@reviews_bp.route("/products/<int:product_id>/reviews/can-review", methods=["GET"])
@jwt_required()
def can_review_product(product_id):
    """Verificar si el usuario puede dejar una review para un producto"""
    try:
        current_user_id = get_jwt_identity()
        
        # Check if product exists
        product = Product.query.get(product_id)
        if not product:
            return error_response(404, "not_found", "Product not found")
        
        # Check if user already reviewed
        existing_review = Review.query.filter_by(
            product_id=product_id,
            user_id=current_user_id
        ).first()
        
        if existing_review:
            return jsonify({
                "can_review": False,
                "reason": "already_reviewed",
                "existing_review": existing_review.to_dict()
            }), 200
        
        # Check if user purchased this product
        purchased = db.session.query(OrderItem).join(Order).filter(
            Order.user_id == current_user_id,
            OrderItem.product_id == product_id,
            Order.status == 'delivered'
        ).first()
        
        return jsonify({
            "can_review": True,
            "has_purchased": purchased is not None
        }), 200
        
    except Exception as e:
        logger.error(f"Error checking review eligibility: {str(e)}")
        return error_response(500, "server_error", "Error checking review eligibility")
