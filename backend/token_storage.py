"""
Redis-based token storage for scalable authentication.

BRUTAL HONEST TRUTH:
- In-memory storage (current) = Lost on restart, doesn't scale
- Redis storage = Persistent, scalable, production-ready
- This module falls back to in-memory if Redis unavailable (dev only)
"""

import os
import json
import time
from typing import Optional, Dict

# Try to import Redis
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("⚠️  WARNING: Redis not installed. Using in-memory fallback (NOT for production!)")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
TOKEN_TTL = 1800  # 30 minutes

# Fallback in-memory storage (ONLY for development)
_fallback_storage = {}

class TokenStorage:
    """Token storage using Redis (or in-memory fallback for dev)."""
    
    def __init__(self):
        self.use_redis = False
        self.redis_client = None
        
        if REDIS_AVAILABLE:
            try:
                self.redis_client = redis.from_url(REDIS_URL, decode_responses=True)
                # Test connection
                self.redis_client.ping()
                self.use_redis = True
                print("✅ Redis connected - using Redis for token storage")
            except (redis.ConnectionError, Exception) as e:
                print(f"⚠️  WARNING: Redis connection failed: {e}")
                print("⚠️  Using in-memory fallback (NOT for production!)")
                self.use_redis = False
        else:
            print("⚠️  Redis not available - using in-memory fallback (NOT for production!)")
            self.use_redis = False
    
    def store_token(self, token: str, user_role: str, user_id: Optional[int] = None) -> None:
        """Store token with expiration."""
        token_data = {
            "user_role": user_role,
            "user_id": user_id,
            "created_at": time.time()
        }
        
        if self.use_redis:
            self.redis_client.setex(
                f"token:{token}",
                TOKEN_TTL,
                json.dumps(token_data)
            )
        else:
            # Fallback: in-memory storage
            _fallback_storage[token] = {
                **token_data,
                "expires_at": time.time() + TOKEN_TTL
            }
    
    def get_token_data(self, token: str) -> Optional[Dict]:
        """Get token data if valid."""
        if not token:
            return None
        
        if self.use_redis:
            data = self.redis_client.get(f"token:{token}")
            if not data:
                return None
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                return None
        else:
            # Fallback: in-memory storage
            if token not in _fallback_storage:
                return None
            
            token_data = _fallback_storage[token]
            
            # Check expiration
            if time.time() > token_data.get("expires_at", 0):
                del _fallback_storage[token]
                return None
            
            return token_data
    
    def delete_token(self, token: str) -> None:
        """Delete token."""
        if self.use_redis:
            self.redis_client.delete(f"token:{token}")
        else:
            # Fallback: in-memory storage
            _fallback_storage.pop(token, None)
    
    def extend_token(self, token: str, additional_seconds: int = 1800) -> bool:
        """Extend token expiration."""
        if self.use_redis:
            return bool(self.redis_client.expire(f"token:{token}", additional_seconds))
        else:
            # Fallback: in-memory storage
            if token in _fallback_storage:
                _fallback_storage[token]["expires_at"] = time.time() + additional_seconds
                return True
            return False

# Global instance
_token_storage = None

def get_token_storage() -> TokenStorage:
    """Get or create token storage instance."""
    global _token_storage
    if _token_storage is None:
        _token_storage = TokenStorage()
    return _token_storage



