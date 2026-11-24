using System.ComponentModel.DataAnnotations;

namespace HomeSeller.UserService.DTO.Profile;

public class ProfileRequest
{
    [Required(ErrorMessage = "Имя обязательно для заполнения")]
    [MaxLength(100, ErrorMessage = "Имя не должно превышать 100 символов")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "Описание не должно превышать 500 символов")]
    public string Description { get; set; } = string.Empty;

    [MaxLength(20, ErrorMessage = "Номер телефона не должен превышать 20 символов")]
    [Phone(ErrorMessage = "Некорректный формат номера телефона")]
    public string PhoneNumber { get; set; } = string.Empty;
}