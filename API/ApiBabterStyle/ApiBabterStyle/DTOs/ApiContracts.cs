using ApiBabterStyle.Model;

namespace ApiBabterStyle.DTOs;

public record RegisterRequest(string Name, string Email, string Phone, string Password);

public record LoginRequest(string Email, string Password);

public record AuthResponse(Guid UserId, string Name, string Email, string Role, string Token, DateTime ExpiresAt);

public record BarberResponse(Guid Id, string Name, string Specialty);

public record ServiceResponse(Guid Id, string Name, string Description, decimal Price, int DurationMinutes);

public record AdminServiceResponse(Guid Id, string Name, string Description, decimal Price, int DurationMinutes, bool Active);

public record CreateServiceRequest(string Name, string Description, decimal Price, int DurationMinutes);

public record UpdateServiceRequest(string Name, string Description, decimal Price, int DurationMinutes, bool Active);

public record ProductResponse(
    Guid Id,
    string Name,
    string Description,
    string Category,
    decimal Price,
    int StockQuantity,
    string ImageUrl,
    bool Active);

public record CreateProductRequest(
    string Name,
    string Description,
    string Category,
    decimal Price,
    int StockQuantity,
    string? ImageUrl);

public record UpdateProductRequest(
    string Name,
    string Description,
    string Category,
    decimal Price,
    int StockQuantity,
    string? ImageUrl,
    bool Active);

public record CreateAppointmentRequest(
    Guid BarberId,
    Guid ServiceId,
    DateTime ScheduledAt,
    string? Notes,
    bool CreatePayment = true);

public record PublicAppointmentRequest(
    string CustomerName,
    string CustomerPhone,
    string? CustomerEmail,
    string BarberName,
    string ServiceName,
    DateTime ScheduledAt,
    string? Unit,
    string? Notes,
    bool PayOnline);

public record AppointmentResponse(
    Guid Id,
    Guid BarberId,
    string BarberName,
    Guid ServiceId,
    string ServiceName,
    decimal Price,
    DateTime ScheduledAt,
    string Status,
    string PaymentStatus,
    string? PaymentUrl,
    string? Notes);

public record PublicAppointmentResponse(
    Guid Id,
    string CustomerName,
    string BarberName,
    string ServiceName,
    decimal Price,
    DateTime ScheduledAt,
    string Status,
    string PaymentStatus,
    string PaymentMethod,
    string? PaymentUrl,
    string Message);

public record PublicAppointmentStatusResponse(
    Guid Id,
    string CustomerName,
    string BarberName,
    string ServiceName,
    DateTime ScheduledAt,
    string Status,
    string PaymentStatus,
    string? Notes);

public record AdminAppointmentResponse(
    Guid Id,
    Guid UserId,
    string CustomerName,
    string CustomerEmail,
    string CustomerPhone,
    Guid BarberId,
    string BarberName,
    Guid ServiceId,
    string ServiceName,
    decimal Price,
    DateTime ScheduledAt,
    string Status,
    string PaymentStatus,
    string? PaymentUrl,
    string? Notes,
    DateTime CreatedAt);

public record MercadoPagoPreferenceRequest(Guid AppointmentId);

public record MercadoPagoPreferenceResponse(
    Guid AppointmentId,
    string? PreferenceId,
    string CheckoutUrl,
    PaymentStatus PaymentStatus);
