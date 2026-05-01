namespace ApiBabterStyle.Model;

public class Barber
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public bool Active { get; set; } = true;

    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
}
