namespace ProductService.ImagesServices;

public class ImagesSystem
{
    private readonly IHostEnvironment _env;
    private const string FolderName = "imageStore";

    enum coded
    {
        jpg,
        png,
        jpeg,
        gif,
        bmp,
        pngbmp,
        
    }
    public ImagesSystem(IHostEnvironment env)
    {
        _env = env;
    }
    private string InitDirectory()
    {
     
        var safeFolder = Path.Combine(_env.ContentRootPath, FolderName);
        Directory.CreateDirectory(safeFolder);
        return safeFolder;
    }
    public async Task<string> SaveImageAsync(IFormFile Uploadfile)
    {
        try
        {
            if ( Uploadfile.Length == 0)
            {
                throw new Exception("Uploadfile is empty");
            }
            
  
            var extension = Path.GetExtension(Uploadfile.FileName).TrimStart('.');
            if (string.IsNullOrWhiteSpace(extension)||
                !Enum.TryParse<coded>(extension, true, out var code)||
                !Enum.IsDefined(typeof(coded), code))
            {
                throw new Exception($"Недопустимый формат файла. Разрешены: {string.Join(", ", Enum.GetNames<coded>())}");
            }          
            var safefolder = InitDirectory();
            var uniquefilename = $"{Guid.NewGuid()}{extension}";
            var clearpath = Path.Combine(safefolder, uniquefilename);

            using (var filestream = new FileStream(clearpath, FileMode.Create))
            {
                await Uploadfile.CopyToAsync(filestream);
            }

            return $"/{FolderName}/{uniquefilename}";

        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }

    public void DeleteImage(string relativeImageUrl)
    {if (string.IsNullOrWhiteSpace(relativeImageUrl)) return;
        var safeFolder = InitDirectory();

        var filename = Path.GetFileName(relativeImageUrl);
        var clearpath = Path.Combine(safeFolder, filename);

     
            File.Delete(clearpath);
        
      
    }

    public void DeleteImages(IEnumerable<string> relativeImageUrl)
    {
        Parallel.ForEach(relativeImageUrl, new ParallelOptions { MaxDegreeOfParallelism = 4 }, DeleteImage);
    }
}