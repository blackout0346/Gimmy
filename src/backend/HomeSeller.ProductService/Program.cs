using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using DotNetEnv;
using HomeSellerServer.Interface;
using HomeSellerServer.Module;
using MassTransit;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;

using ProductService.Consume;
using ProductService.ImagesServices;
using ProductService.Interface;
using ProductService.Module;
using Microsoft.OpenApi;
using Npgsql;
using ProductService.StoreService;
using StackExchange.Redis;

DotNetEnv.Env.TraversePath().Load();
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "HomeSeller API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Введите JWT-токен (без слова Bearer, оно подставится автоматически)"
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});
builder.Services.AddMemoryCache();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendCorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
var redisHost = builder.Configuration["Redis:HostLocal"] ?? "localhost";
var redisPort = builder.Configuration["Redis:Port"] ?? "6379";
var redispassword = builder.Configuration["Redis:Password"];
var configOptions = new ConfigurationOptions
{
    EndPoints = { $"{redisHost}:{redisPort}" },
    Password = string.IsNullOrEmpty(redispassword) ? "guest" : redispassword,
    AbortOnConnectFail = false,
};
builder.Services.AddRateLimiter(options =>
{
    options.AddSlidingWindowLimiter("sliding_window", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromSeconds(1);
        opt.SegmentsPerWindow = 4;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 2;
    });
});
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<UserDeleteConsumer>();
    x.UsingRabbitMq((context, cfg) =>
    {
        var host = builder.Configuration["RabbitMQ:HostNameLocal"]?? "localhost";
        cfg.Host(host, hostConfigurator =>
        {
            hostConfigurator.Username(builder.Configuration["RabbitMQ:Username"] ?? "guest");
            hostConfigurator.Password(builder.Configuration["RabbitMQ:Password"] ?? "guest");
        });
        cfg.ConfigureEndpoints(context);
    });
});

builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(configOptions));
builder.Services.AddTransient<ImagesSystem>();
builder.Services.AddTransient<IProductStore, ProductStore>();
builder.Services.AddTransient<IProductService, ProductService.Services.ProductService>();

string postgresConnect = GetActiveConnectionString(builder.Configuration);

builder.Services.AddDbContext<ProductDbContext>(options =>
{
    options.UseNpgsql(postgresConnect);
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],     
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ClockSkew = TimeSpan.Zero 
    };
});
var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors("FrontendCorsPolicy");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ProductDbContext>();

    // await context.Database.EnsureDeletedAsync();
    // await context.Database.EnsureCreatedAsync();
     // await context.Database.MigrateAsync();
    

    if (!await context.Tags.AnyAsync())
    {
        var filePath = Path.Combine(AppContext.BaseDirectory, "initData.json");
        if (File.Exists(filePath))
        {
            var json = await File.ReadAllTextAsync(filePath);
            var tags = JsonSerializer.Deserialize<List<Tags>>(json);

            if (tags != null && tags.Count > 0)
            {
                await context.Tags.AddRangeAsync(tags);
                await context.SaveChangesAsync();
            }
        }
    }
}
var imageStorePath = Path.Combine(builder.Environment.ContentRootPath, "imageStore");
Directory.CreateDirectory(imageStorePath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(imageStorePath),
    RequestPath = "/imageStore"
});
app.MapGet("/", () => "Hello World!");

app.Run();

static string GetActiveConnectionString(IConfiguration configuration)
{
    var vpsConnectionString = configuration.GetConnectionString("NpgsqlConnectionVPS");
    var localConnectionString = configuration.GetConnectionString("NpgsqlConnectionLocal");

    // if (!string.IsNullOrEmpty(vpsConnectionString))
    // {
    //     try
    //     {
    //      
    //         using var testConnection = new NpgsqlConnection(vpsConnectionString);
    //         testConnection.Open();
    //         
    //         Console.WriteLine($"[DB] Выбрана база VPS: {testConnection.Host}");
    //         return vpsConnectionString;
    //     }
    //     catch (Exception ex)
    //     {
    //         Console.WriteLine($"[DB] VPS недоступен ({ex.Message}). Переключаемся на localhost...");
    //     }
    // }

    if (string.IsNullOrEmpty(localConnectionString))
    {
        throw new InvalidOperationException("Не найдена строка подключения LocalConnection в .env");
    }

    Console.WriteLine("[DB] Выбрана локальная база данных (localhost)");
    return localConnectionString;
}