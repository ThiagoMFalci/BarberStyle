FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

COPY API/ApiBabterStyle/ApiBabterStyle/ApiBabterStyle.csproj API/ApiBabterStyle/ApiBabterStyle/
RUN dotnet restore API/ApiBabterStyle/ApiBabterStyle/ApiBabterStyle.csproj

COPY API/ApiBabterStyle/ API/ApiBabterStyle/
RUN dotnet publish API/ApiBabterStyle/ApiBabterStyle/ApiBabterStyle.csproj \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

CMD ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} dotnet ApiBabterStyle.dll"]
