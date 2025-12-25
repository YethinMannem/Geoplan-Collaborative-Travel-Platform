"""
Redis caching utilities for improved performance.

BRUTAL HONEST TRUTH:
- Without caching: Every request hits database (slow, expensive)
- With caching: Frequently accessed data cached (fast, efficient)
- This module provides caching decorator and utilities
"""

import redis
import json
import hashlib
import os
from functools import wraps
from typing import Optional, Callable, Any

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_cache_client = None

def get_cache():
    """Get Redis cache client (or None if unavailable)."""
    global _cache_client
    if _cache_client is None:
        try:
            _cache_client = redis.from_url(REDIS_URL, decode_responses=True)
            # Test connection
            _cache_client.ping()
            print("✅ Redis cache connected")
        except (redis.ConnectionError, Exception) as e:
            print(f"⚠️  Redis cache not available: {e}")
            print("⚠️  Caching disabled (NOT for production!)")
            _cache_client = None
    return _cache_client

def cache_key(*args, **kwargs):
    """Generate cache key from function arguments."""
    # Create a unique key from arguments
    key_parts = []
    for arg in args:
        if isinstance(arg, (str, int, float, bool)):
            key_parts.append(str(arg))
        elif arg is None:
            key_parts.append("None")
        else:
            key_parts.append(str(hash(str(arg))))
    
    for k, v in sorted(kwargs.items()):
        if isinstance(v, (str, int, float, bool)):
            key_parts.append(f"{k}:{v}")
        elif v is None:
            key_parts.append(f"{k}:None")
        else:
            key_parts.append(f"{k}:{hash(str(v))}")
    
    key_string = "|".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()

def cached(ttl=300, key_prefix="cache"):
    """
    Decorator to cache function results.
    
    Args:
        ttl: Time to live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache keys
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache = get_cache()
            
            # If cache unavailable, just call function
            if not cache:
                return func(*args, **kwargs)
            
            # Generate cache key
            func_key = f"{key_prefix}:{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            try:
                cached_value = cache.get(func_key)
                if cached_value:
                    return json.loads(cached_value)
            except (json.JSONDecodeError, redis.RedisError) as e:
                # If cache read fails, continue to compute
                print(f"Cache read error: {e}")
            
            # Compute result
            result = func(*args, **kwargs)
            
            # Cache result
            try:
                cache.setex(func_key, ttl, json.dumps(result))
            except (TypeError, redis.RedisError) as e:
                # If caching fails, that's OK - just log it
                print(f"Cache write error: {e}")
            
            return result
        return wrapper
    return decorator

def invalidate_cache(pattern: str):
    """Invalidate cache entries matching a pattern."""
    cache = get_cache()
    if not cache:
        return
    
    try:
        keys = cache.keys(f"cache:{pattern}*")
        if keys:
            cache.delete(*keys)
            print(f"✅ Invalidated {len(keys)} cache entries")
    except redis.RedisError as e:
        print(f"Cache invalidation error: {e}")

def clear_all_cache():
    """Clear all cache entries (use with caution!)."""
    cache = get_cache()
    if not cache:
        return
    
    try:
        keys = cache.keys("cache:*")
        if keys:
            cache.delete(*keys)
            print(f"✅ Cleared {len(keys)} cache entries")
    except redis.RedisError as e:
        print(f"Cache clear error: {e}")


