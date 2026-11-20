using System.Text;
using System.Threading.RateLimiting;
using HomeSeller.Messenger.Controller;
using HomeSeller.Messenger.ImagesServices;
using HomeSeller.Messenger.Interface;
using HomeSeller.Messenger.Models;
using HomeSeller.Messenger.Services;
using HomeSeller.Messenger.StoreService;
using MassTransit;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

using StackExchange.Redis;

DotNetEnv.Env.TraversePath().Load();
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMemoryCache();
builder.Services.AddControllers();

// --- НАЧАЛО КОНФИГУРАЦИИ SWAGGER ---
builder.Services.AddEndpointsApiExplorer();
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

    // Новый синтаксис для Microsoft.OpenApi v2 / Swashbuckle v10+
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = new List<string>()
    });
});
// --- КОНЕЦ КОНФИГУРАЦИИ SWAGGER ---

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("NpgsqlConnection"));
});

builder.Services.AddTransient<ImagesSystem>();
builder.Services.AddScoped<IMessangerStore, MessangerStore>();
builder.Services.AddScoped<IMessangerService, MessangerService>();

builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendCorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var redisHost = builder.Configuration["Redis:Host"] ?? "localhost";
var redisPort = builder.Configuration["Redis:Port"] ?? "6379";
var redispassword = builder.Configuration["Redis:Password"];
var configOptions = new ConfigurationOptions
{
    EndPoints = { $"{redisHost}:{redisPort}" },
    Password = redispassword,
    AbortOnConnectFail = false,
};

builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(configOptions));
builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        var host = builder.Configuration["RabbitMQ:HostName"] ?? "localhost";
        cfg.Host(host, "/", h =>
            {
                h.Username(builder.Configuration["RabbitMQ:Username"] ?? "guest");
                h.Password(builder.Configuration["RabbitMQ:Password"] ?? "guest");
            }
        );
    });
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
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/messenger"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

var app = builder.Build();

// --- ВКЛЮЧЕНИЕ SWAGGER UI ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
// ----------------------------

app.UseCors("FrontendCorsPolicy");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapHub<MessengerHub>("/hubs/messenger");
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.Database.MigrateAsync();
}

var imageStorePath = Path.Combine(builder.Environment.ContentRootPath, "imageStore");
Directory.CreateDirectory(imageStorePath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(imageStorePath),
    RequestPath = "/AttachmentMessage"
});

app.MapGet("/", () => "Hello World!");

app.Run();