import { Injectable, Logger } from '@nestjs/common';
import { Contact } from '../entities/contact.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileGenerationService {
  private readonly logger = new Logger(FileGenerationService.name);

  async generateExcelFile(
    userId: number,
    actionId: number,
    contacts: Contact[],
  ): Promise<string> {
    // Convert to CSV format
    const csvHeader =
      'ID,HubSpot ID,Email,First Name,Last Name,Phone,Company,Create Date,Last Modified Date\n';

    const csvRows = contacts
      .map((contact) => {
        const fields = [
          contact.id,
          contact.hubspotId || '',
          contact.email || '',
          contact.firstName || '',
          contact.lastName || '',
          contact.phone || '',
          contact.company || '',
          contact.createDate?.toISOString() || '',
          contact.lastModifiedDate?.toISOString() || '',
        ];
        return fields
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(',');
      })
      .join('\n');

    const csvContent = csvHeader + csvRows;

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate filename
    const fileName = `contacts_${userId}_${actionId}_${Date.now()}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file
    fs.writeFileSync(filePath, csvContent, 'utf8');

    // Return URL
    const fileUrl = `/uploads/${fileName}`;

    this.logger.log(`Generated CSV file: ${fileUrl}`);
    return fileUrl;
  }
}
