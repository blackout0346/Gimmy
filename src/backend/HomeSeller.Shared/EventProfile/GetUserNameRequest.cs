namespace HomeSeller.Shared.EventProfile;

public class GetUserNameRequest
{
    public Guid UserId { get; set; }
}

public class GetUserNameResponse
{
    public string UserName { get; set; } = string.Empty;
}