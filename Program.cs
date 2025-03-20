using SignalRChat.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddSignalR(options =>
{
});
builder.Services.AddScoped<GlobalMessageFilter>();
var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

// 使用強類型Hub
app.MapHub<ChatHub>("/chatHub");
app.MapGet("/", () => Results.Redirect("/index.html"));

app.Run();