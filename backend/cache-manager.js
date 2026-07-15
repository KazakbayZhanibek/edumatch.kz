/**
 * cache-manager.js
 * Простой встроенный кеш для Node.js
 */

class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 10 * 60 * 1000; // 10 минут по умолчанию
    this.maxSize = options.maxSize || 1000; // Max ключей
    this.cleanupInterval = options.cleanupInterval || 60 * 1000; // Очистка каждую минуту
    
    // Периодическая очистка старых записей
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Получить значение из кеша
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Проверяем TTL
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Сохранить значение в кеш
   */
  set(key, value, ttl = this.ttl) {
    // Если кеш переполнен, удаляем самую старую запись
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  /**
   * Удалить из кеша
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Очистить весь кеш
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Очистить истекшие записи
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Статистика кеша
   */
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        size: JSON.stringify(entry.value).length,
        age: Date.now() - entry.createdAt,
        ttl: entry.expiry - Date.now()
      }))
    };
  }

  /**
   * Остановить периодическую очистку
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

module.exports = CacheManager;
