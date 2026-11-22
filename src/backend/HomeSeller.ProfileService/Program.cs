
using System.Text;
using System.Threading.RateLimiting;
using HomeSeller.UserService.Modules;
using MassTransit;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Npgsql;
using StackExchange.Redis;

DotNetEnv.Env.TraversePath().Load();
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddMemoryCache();
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
var redisPassword = builder.Configuration["Redis:Password"];
var configOptions = new ConfigurationOptions
{
    EndPoints = { $"{redisHost}:{redisPort}" },
    Password = redisPassword,
    AbortOnConnectFail = false,
};

builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        var host = builder.Configuration["RabbitMQ:HostNameLocal"] ?? "localhost";
        cfg.Host(host, "/", h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "guest");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? "guest");
        });
    });
});

string postgresConnect = GetActiveConnectionString(builder.Configuration);

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(postgresConnect);
});


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

// using (var scope = app.Services.CreateScope())
// {
//     var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
//
//     await context.Database.MigrateAsync();
// }
app.MapGet("/", () => "Hello World!");

app.Run();
static string GetActiveConnectionString(IConfiguration configuration)
{
    var vpsConnectionString = configuration.GetConnectionString("NpgsqlConnectionVPS");
    var localConnectionString = configuration.GetConnectionString("NpgsqlConnectionLocal");

    if (!string.IsNullOrEmpty(vpsConnectionString))
    {
        try
        {
         
            using var testConnection = new NpgsqlConnection(vpsConnectionString);
            testConnection.Open();
            
            Console.WriteLine($"[DB] Выбрана база VPS: {testConnection.Host}");
            return vpsConnectionString;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB] VPS недоступен ({ex.Message}). Переключаемся на localhost...");
        }
    }

    if (string.IsNullOrEmpty(localConnectionString))
    {
        throw new InvalidOperationException("Не найдена строка подключения LocalConnection в .env");
    }

    Console.WriteLine("[DB] Выбрана локальная база данных (localhost)");
    return localConnectionString;
}