"""
Input validation schemas using Marshmallow.

BRUTAL HONEST TRUTH:
- Current validation is basic (try/except)
- Marshmallow provides better validation, error messages, and security
- Prevents invalid data from reaching database
"""

from marshmallow import Schema, fields, validate, ValidationError, validates_schema

class RadiusSearchSchema(Schema):
    """Validation schema for radius search endpoint."""
    lat = fields.Float(
        required=True,
        validate=validate.Range(min=-90, max=90),
        error_messages={
            "required": "Latitude is required",
            "invalid": "Latitude must be a number",
            "validator_failed": "Latitude must be between -90 and 90"
        }
    )
    lon = fields.Float(
        required=True,
        validate=validate.Range(min=-180, max=180),
        error_messages={
            "required": "Longitude is required",
            "invalid": "Longitude must be a number",
            "validator_failed": "Longitude must be between -180 and 180"
        }
    )
    km = fields.Float(
        missing=10,
        validate=validate.Range(min=0.1, max=1000),
        error_messages={
            "invalid": "Radius must be a number",
            "validator_failed": "Radius must be between 0.1 and 1000 km"
        }
    )
    state = fields.Str(
        missing=None,
        validate=validate.Length(max=100),
        allow_none=True,
        error_messages={
            "invalid": "State must be a string",
            "validator_failed": "State name too long (max 100 characters)"
        }
    )
    name = fields.Str(
        missing=None,
        validate=validate.Length(max=200),
        allow_none=True,
        error_messages={
            "invalid": "Name must be a string",
            "validator_failed": "Name too long (max 200 characters)"
        }
    )
    place_type = fields.Str(
        missing=None,
        validate=validate.OneOf(["brewery", "restaurant", "tourist_place", "hotel"]),
        allow_none=True,
        error_messages={
            "validator_failed": "place_type must be one of: brewery, restaurant, tourist_place, hotel"
        }
    )


class NearestSearchSchema(Schema):
    """Validation schema for nearest search endpoint."""
    lat = fields.Float(
        required=True,
        validate=validate.Range(min=-90, max=90),
        error_messages={
            "required": "Latitude is required",
            "invalid": "Latitude must be a number",
            "validator_failed": "Latitude must be between -90 and 90"
        }
    )
    lon = fields.Float(
        required=True,
        validate=validate.Range(min=-180, max=180),
        error_messages={
            "required": "Longitude is required",
            "invalid": "Longitude must be a number",
            "validator_failed": "Longitude must be between -180 and 180"
        }
    )
    k = fields.Int(
        missing=10,
        validate=validate.Range(min=1, max=100),
        error_messages={
            "invalid": "k must be an integer",
            "validator_failed": "k must be between 1 and 100"
        }
    )
    state = fields.Str(
        missing=None,
        validate=validate.Length(max=100),
        allow_none=True
    )
    name = fields.Str(
        missing=None,
        validate=validate.Length(max=200),
        allow_none=True
    )
    place_type = fields.Str(
        missing=None,
        validate=validate.OneOf(["brewery", "restaurant", "tourist_place", "hotel"]),
        allow_none=True
    )


class BoundingBoxSchema(Schema):
    """Validation schema for bounding box search endpoint."""
    north = fields.Float(
        required=True,
        validate=validate.Range(min=-90, max=90),
        error_messages={
            "required": "North latitude is required",
            "invalid": "North must be a number",
            "validator_failed": "North must be between -90 and 90"
        }
    )
    south = fields.Float(
        required=True,
        validate=validate.Range(min=-90, max=90),
        error_messages={
            "required": "South latitude is required",
            "invalid": "South must be a number",
            "validator_failed": "South must be between -90 and 90"
        }
    )
    east = fields.Float(
        required=True,
        validate=validate.Range(min=-180, max=180),
        error_messages={
            "required": "East longitude is required",
            "invalid": "East must be a number",
            "validator_failed": "East must be between -180 and 180"
        }
    )
    west = fields.Float(
        required=True,
        validate=validate.Range(min=-180, max=180),
        error_messages={
            "required": "West longitude is required",
            "invalid": "West must be a number",
            "validator_failed": "West must be between -180 and 180"
        }
    )
    state = fields.Str(
        missing=None,
        validate=validate.Length(max=100),
        allow_none=True
    )
    name = fields.Str(
        missing=None,
        validate=validate.Length(max=200),
        allow_none=True
    )
    place_type = fields.Str(
        missing=None,
        validate=validate.OneOf(["brewery", "restaurant", "tourist_place", "hotel"]),
        allow_none=True
    )
    
    @validates_schema
    def validate_bbox(self, data, **kwargs):
        """Validate that bounding box makes sense."""
        if 'north' in data and 'south' in data:
            if data['north'] <= data['south']:
                raise ValidationError("North latitude must be greater than south latitude")
        if 'east' in data and 'west' in data:
            if data['east'] <= data['west']:
                raise ValidationError("East longitude must be greater than west longitude")


class AddPlaceSchema(Schema):
    """Validation schema for adding a new place."""
    name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=200),
        error_messages={
            "required": "Name is required",
            "validator_failed": "Name must be between 1 and 200 characters"
        }
    )
    city = fields.Str(
        missing="",
        validate=validate.Length(max=100),
        error_messages={
            "validator_failed": "City name too long (max 100 characters)"
        }
    )
    state = fields.Str(
        missing="",
        validate=validate.Length(max=100),
        error_messages={
            "validator_failed": "State name too long (max 100 characters)"
        }
    )
    country = fields.Str(
        missing="US",
        validate=validate.Length(max=2),
        error_messages={
            "validator_failed": "Country code must be 2 characters (e.g., US)"
        }
    )
    lat = fields.Float(
        required=True,
        validate=validate.Range(min=-90, max=90),
        error_messages={
            "required": "Latitude is required",
            "invalid": "Latitude must be a number",
            "validator_failed": "Latitude must be between -90 and 90"
        }
    )
    lon = fields.Float(
        required=True,
        validate=validate.Range(min=-180, max=180),
        error_messages={
            "required": "Longitude is required",
            "invalid": "Longitude must be a number",
            "validator_failed": "Longitude must be between -180 and 180"
        }
    )
    place_type = fields.Str(
        missing="brewery",
        validate=validate.OneOf(["brewery", "restaurant", "tourist_place", "hotel"]),
        error_messages={
            "validator_failed": "place_type must be one of: brewery, restaurant, tourist_place, hotel"
        }
    )
    type_data = fields.Dict(
        missing={},
        allow_none=True
    )


class LoginSchema(Schema):
    """Validation schema for login endpoint."""
    username = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=50),
        error_messages={
            "required": "Username is required",
            "validator_failed": "Username must be between 1 and 50 characters"
        }
    )
    password = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=200),
        error_messages={
            "required": "Password is required",
            "validator_failed": "Password too long (max 200 characters)"
        }
    )


class AnalyticsDensitySchema(Schema):
    """Validation schema for analytics density endpoint."""
    lat = fields.Float(
        missing=0,
        validate=validate.Range(min=-90, max=90),
        error_messages={
            "invalid": "Latitude must be a number",
            "validator_failed": "Latitude must be between -90 and 90"
        }
    )
    lon = fields.Float(
        missing=0,
        validate=validate.Range(min=-180, max=180),
        error_messages={
            "invalid": "Longitude must be a number",
            "validator_failed": "Longitude must be between -180 and 180"
        }
    )
    radius = fields.Float(
        missing=100,
        validate=validate.Range(min=0.1, max=10000),
        error_messages={
            "invalid": "Radius must be a number",
            "validator_failed": "Radius must be between 0.1 and 10000 km"
        }
    )


class DistanceMatrixSchema(Schema):
    """Validation schema for distance matrix endpoint."""
    points = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=10000),
        error_messages={
            "required": "points parameter is required",
            "validator_failed": "points string too long (max 10000 characters)"
        }
    )


class ExportSchema(Schema):
    """Validation schema for export endpoints (CSV, GeoJSON)."""
    state = fields.Str(
        missing=None,
        validate=validate.Length(max=100),
        allow_none=True,
        error_messages={
            "validator_failed": "State name too long (max 100 characters)"
        }
    )
    name = fields.Str(
        missing=None,
        validate=validate.Length(max=200),
        allow_none=True,
        error_messages={
            "validator_failed": "Name too long (max 200 characters)"
        }
    )
    limit = fields.Int(
        missing=10000,
        validate=validate.Range(min=1, max=100000),
        allow_none=True,
        error_messages={
            "invalid": "limit must be an integer",
            "validator_failed": "limit must be between 1 and 100000"
        }
    )

