namespace ProductService.ImagesServices;

public class ImagesSystem
{
    private readonly IHostEnvironment _env;
    private const string RootFolderName = "imageStore";

    private enum AllowedExtensions
    {
        jpg,
        png,
        jpeg,
        gif,
        bmp,
        pngbmp
    }

    public ImagesSystem(IHostEnvironment env)
    {
        _env = env;
    }

    private string InitDirectory(string? subFolder = null)
    {
        var rootFolder = Path.Combine(_env.ContentRootPath, RootFolderName);
        var targetFolder = string.IsNullOrWhiteSpace(subFolder)
            ? rootFolder
            : Path.Combine(rootFolder, subFolder.Trim('/', '\\'));

        Directory.CreateDirectory(targetFolder);
        return targetFolder;
    }

    public async Task<string> SaveImageAsync(IFormFile uploadFile, string? subFolder = null)
    {
        if (uploadFile == null || uploadFile.Length == 0)
        {
            throw new Exception("Uploadfile is empty");
        }

        var extension = Path.GetExtension(uploadFile.FileName).TrimStart('.');
        if (string.IsNullOrWhiteSpace(extension) ||
            !Enum.TryParse<AllowedExtensions>(extension, true, out var code) ||
            !Enum.IsDefined(typeof(AllowedExtensions), code))
        {
            throw new Exception($"Недопустимый формат файла. Разрешены: {string.Join(", ", Enum.GetNames<AllowedExtensions>())}");
        }

        var safeFolder = InitDirectory(subFolder);
        var uniqueFileName = $"{Guid.NewGuid()}.{extension.ToLowerInvariant()}";
        var clearPath = Path.Combine(safeFolder, uniqueFileName);

        await using (var fileStream = new FileStream(clearPath, FileMode.Create))
        {
            await uploadFile.CopyToAsync(fileStream);
        }

        return string.IsNullOrWhiteSpace(subFolder)
            ? $"/{RootFolderName}/{uniqueFileName}"
            : $"/{RootFolderName}/{subFolder.Trim('/')}/{uniqueFileName}";
    }

    public void DeleteImage(string relativeImageUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeImageUrl)) return;

        var rootFolder = Path.GetFullPath(InitDirectory());

   
        var relativePath = relativeImageUrl.TrimStart('/');
        if (relativePath.StartsWith($"{RootFolderName}/", StringComparison.OrdinalIgnoreCase))
        {
            relativePath = relativePath[(RootFolderName.Length + 1)..];
        }

        var fullPath = Path.GetFullPath(Path.Combine(rootFolder, relativePath));

    
        if (!fullPath.StartsWith(rootFolder, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }

    public void DeleteImages(IEnumerable<string> relativeImageUrls)
    {
        Parallel.ForEach(relativeImageUrls, new ParallelOptions { MaxDegreeOfParallelism = 4 }, DeleteImage);
    }
}