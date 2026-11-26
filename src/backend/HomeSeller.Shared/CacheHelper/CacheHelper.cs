using System.Text.Json;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace HomeSeller.Shared.CacheHelper;

public static class CacheHelper
{
    public static async Task SetCacheAsync<T>(IDatabase redis, ILogger logger, T value, string cacheKey,
        TimeSpan? cacheExpiry)
    {
        try
        {
            var json = JsonSerializer.Serialize(value);
            await redis.StringSetAsync(cacheKey, json, cacheExpiry ?? TimeSpan.FromMinutes(5));
            logger.LogInformation("Set cache for {CacheKey}", cacheKey);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to set cache for {CacheKey}", cacheKey);
        }
    }

    public static async Task<T?> GetCacheAsync<T>(IDatabase redis, ILogger logger, string cacheKey)
    {
        try
        {
            var cacheJson = await redis.StringGetAsync(cacheKey);
            if (!cacheJson.HasValue)
            {
                return default;
            }

            logger.LogInformation("Get cache for {CacheKey}", cacheKey);
            return JsonSerializer.Deserialize<T>((string)cacheJson!);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to get cache for {CacheKey}", cacheKey);
            return default;
        }
    }

    public static async Task InvalidateCacheAsync(IDatabase redis, ILogger logger, string cacheKey)
    {
        try
        {
            await redis.KeyDeleteAsync(cacheKey);
            logger.LogInformation("Invalidate {CacheKey}", cacheKey);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to invalidate {CacheKey}", cacheKey);
        }
    }

    public static async Task<long> GetVersionAsync(IDatabase redis, ILogger logger, string versionKey)
    {
        try
        {
            var version = await redis.StringGetAsync(versionKey);
            if (version.HasValue && long.TryParse(version.ToString(), out var parsed))
            {
                return parsed;
            }

            await redis.StringSetAsync(versionKey, 1);
            return 1;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to get cache version for {VersionKey}", versionKey);
            return 1;
        }
    }

    public static async Task IncrementVersionAsync(IDatabase redis, ILogger logger, string versionKey)
    {
        try
        {
            var newVersion = await redis.StringIncrementAsync(versionKey);
            logger.LogInformation("Incremented cache version {VersionKey} to {NewVersion}", versionKey, newVersion);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to increment cache version for {VersionKey}", versionKey);
        }
    }
}