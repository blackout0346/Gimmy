using HomeSeller.Shared.CacheHelper;
using HomeSeller.Shared.EventUser;
using HomeSellerServer.DTO;
using HomeSellerServer.Exceptions;
using HomeSellerServer.Interface;
using HomeSellerServer.Module;
using MassTransit;
using StackExchange.Redis;

namespace HomeSellerServer.Services
{
    public class AuthService : IAuthService
    {
        private readonly IHashPassword _hashPassword;
        private readonly IUserStore _userStore;
        private readonly IPublishEndpoint _publishEndpoint;
        private readonly ILogger<AuthService> _logger;

        private readonly IJwtTokenGenerator _tokenService;

        public AuthService(IHashPassword hashPassword, IUserStore userStore, IPublishEndpoint publishEndpoint,
            IJwtTokenGenerator tokenService, ILogger<AuthService> logger)
        {

            _logger = logger;
            _publishEndpoint = publishEndpoint;
            _hashPassword = hashPassword;
            _userStore = userStore;
            _tokenService = tokenService;
        }

        async Task<RegisterResponse> IAuthService.RegisterAsync(RegisterRequest registerRequest)
        {
            var exists = await _userStore.ExistsByLoginAsync(registerRequest.Login);
            if (exists)
            {
                _logger.LogWarning("user already exists.");
                throw new UserAlreadyExistsException();
            }

            var hashpassword = await _hashPassword.HashPasswordAsync(registerRequest.Password);

            var user = new Users
            {
                Login = registerRequest.Login,
                HashPassword = hashpassword,
      
            };
           
            
            await _userStore.AddAsync(user);
            await _publishEndpoint.Publish(new UserRegisteredEvent
            {
                UserId = user.Id,
                Login = user.Login,
            });
            return new RegisterResponse
            {
                Login = user.Login,
                UserId = user.Id,
                Token = _tokenService.GenerateToken(user)
            };
        }

        async Task<LoginResponse> IAuthService.LoginAsync(LoginRequest loginRequest)
        {
            
            var user = await _userStore.FindByLoginAsync(loginRequest.Login);
            if (user == null)
            {
                _logger.LogWarning("Ivalid login or password.");
                throw new UnauthorizedAccessException("Неверный логин или пароль.");
            }
         
            var hashpaswword = await _hashPassword.VerifyPasswordAsync(loginRequest.Password, user.HashPassword);

            if (!hashpaswword)
            {
                _logger.LogWarning("Ivalid login or password.");
                throw new UnauthorizedAccessException("Неверный логин или пароль.");
            }

            await _publishEndpoint.Publish(new UserLoginEvent()
            {
                UserId = user.Id,
                Login = loginRequest.Login,
            });
          
            return new LoginResponse
            {
                Login = user.Login,
                UserId = user.Id,
                Token = _tokenService.GenerateToken(user)
            };
        }

        public async Task<bool> ChangePasswordAsync(ChangePasswordRequest request)
        {
            var user = await _userStore.FindByLoginAsync(request.Login);
            if (user == null)
            {
                _logger.LogWarning("invalid login or password.");
                return false;
            }


            var isCurrentPasswordValid =
                await _hashPassword.VerifyPasswordAsync(request.CurrentPassword, user.HashPassword);
            if (!isCurrentPasswordValid)
            {
                _logger.LogWarning("Ivalid current password.");
                return false;
            }


            user.HashPassword = await _hashPassword.HashPasswordAsync(request.NewPassword);


            await _userStore.UpdateUserAsync(user);
            await _publishEndpoint.Publish(new UserChangePasswordEvent()
            {
                UserId = user.Id,
                Login = user.Login,
            });
            return true;
        }

        public async Task<bool> DeleteUserAsync(Guid userId)
        {
            var user = await _userStore.GetByIdAsync(userId);
            if (user == null || user.isDeleted)
            {
                return false;
            }

            var deleted = await _userStore.DeleteUserAsync(user);
            if (!deleted)
            {
                return false;
            }

            await _publishEndpoint.Publish(new UserDeletedEvent
            {
                Login =  user.Login,
                UserId = user.Id,
                
            });
           
            return true;
        }
    }
}