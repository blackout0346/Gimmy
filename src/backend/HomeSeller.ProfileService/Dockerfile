FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["HomeSeller.ProfileService/HomeSeller.ProfileService.csproj", "HomeSeller.ProfileService/"]
COPY ["HomeSeller.Shared/HomeSeller.Shared.csproj", "HomeSeller.Shared/"]
RUN dotnet restore "HomeSeller.ProfileService/HomeSeller.ProfileService.csproj"
COPY . .
WORKDIR "/src/HomeSeller.ProfileService"
RUN dotnet build "./HomeSeller.ProfileService.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./HomeSeller.ProfileService.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HomeSeller.ProfileService.dll"]
