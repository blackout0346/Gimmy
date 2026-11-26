namespace HomeSellerServer.Exceptions
{
    public class UserAlreadyExistsException : Exception
    {
        public UserAlreadyExistsException(): base("Пользователь с таким логином уже существует.") { } 
    }
}
