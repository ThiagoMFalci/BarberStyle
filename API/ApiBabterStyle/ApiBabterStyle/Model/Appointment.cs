namespace ApiBabterStyle.Model;

public class Appointment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public string Notes { get; set; } = string.Empty;
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public string? MercadoPagoPreferenceId { get; set; }
    public string? MercadoPagoInitPoint { get; set; }
    public string? MercadoPagoPaymentId { get; set; }
    public string? MercadoPagoRefundId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
    public Barber? Barber { get; set; }
    public BarberService? Service { get; set; }
}

public enum AppointmentStatus
{
    Scheduled = 1,
    Cancelled = 2,
    Completed = 3,
    WaitingPayment = 4
}

public enum PaymentStatus
{
    Pending = 1,
    WaitingMercadoPago = 2,
    Paid = 3,
    Cancelled = 4,
    Failed = 5,
    Refunded = 6
}
