using ApiBabterStyle.Data;
using ApiBabterStyle.DTOs;
using ApiBabterStyle.Model;
using ApiBabterStyle.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ApiBabterStyle.Controller;

[ApiController]
[Route("api/auth")]
public class AuthController(BarberShopDbContext db, JwtTokenService jwtTokenService) : ControllerBase
{
    [HttpPost("cadastro")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Nome, email e senha sao obrigatorios." });
        }

        if (request.Password.Length < 6)
        {
            return BadRequest(new { message = "A senha precisa ter pelo menos 6 caracteres." });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var exists = await db.Users.AnyAsync(user => user.Email == email, cancellationToken);
        if (exists)
        {
            return Conflict(new { message = "Ja existe um usuario cadastrado com este email." });
        }

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            Phone = request.Phone.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        var token = jwtTokenService.CreateToken(user);
        return CreatedAtAction(nameof(Register), new AuthResponse(user.Id, user.Name, user.Email, user.Phone, user.Role, token.Token, token.ExpiresAt));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var credential = request.Email.Trim().ToLowerInvariant();
        var user = credential == "admin" && request.Password == "admin"
            ? await GetOrCreateTemporaryAdminAsync(cancellationToken)
            : await db.Users.FirstOrDefaultAsync(item => item.Email == credential, cancellationToken);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Email ou senha invalidos." });
        }

        var token = jwtTokenService.CreateToken(user);
        return Ok(new AuthResponse(user.Id, user.Name, user.Email, user.Phone, user.Role, token.Token, token.ExpiresAt));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<CustomerProfileResponse>> GetProfile(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);

        return user is null
            ? NotFound(new { message = "Usuario nao encontrado." })
            : Ok(ToProfileResponse(user));
    }

    [Authorize]
    [HttpPatch("me")]
    public async Task<ActionResult<CustomerProfileResponse>> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var user = await db.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(new { message = "Usuario nao encontrado." });
        }

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
        {
            return BadRequest(new { message = "Nome e WhatsApp sao obrigatorios." });
        }

        if (!string.IsNullOrWhiteSpace(request.Password) && request.Password.Length < 6)
        {
            return BadRequest(new { message = "A nova senha precisa ter pelo menos 6 caracteres." });
        }

        user.Name = request.Name.Trim();
        user.Phone = request.Phone.Trim();

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        }

        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToProfileResponse(user));
    }

    private static CustomerProfileResponse ToProfileResponse(User user)
        => new(user.Id, user.Name, user.Email, user.Phone, user.Role);

    private async Task<User> GetOrCreateTemporaryAdminAsync(CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(item => item.Email == "admin", cancellationToken);
        if (user is not null)
        {
            if (user.Role != "Admin" || !BCrypt.Net.BCrypt.Verify("admin", user.PasswordHash))
            {
                user.Name = "Proprietario";
                user.Phone = "";
                user.Role = "Admin";
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin");
                await db.SaveChangesAsync(cancellationToken);
            }

            return user;
        }

        user = new User
        {
            Name = "Proprietario",
            Email = "admin",
            Phone = "",
            Role = "Admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin")
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        return user;
    }
}
