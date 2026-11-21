using System.ComponentModel.DataAnnotations.Schema;

namespace HomeSeller.Messenger.Models;

public class Attachment
{
    public Guid Id { get; set; }

    public Guid? MessageId { get; set; }
    public Message? Message { get; set; } 

    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;

    public long Size { get; set; }
}