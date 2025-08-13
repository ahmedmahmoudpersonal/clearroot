import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsObject,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class StartHubSpotFetchDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 200)
  apiKey: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filters?: string[];
}

export class GetDuplicatesDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return 1;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 1 : parsed;
  })
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return 10;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 10 : parsed;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  includeMerged?: boolean = true;
}

export class SubmitMergeDto {
  @IsInt()
  groupId: number;

  @IsInt()
  selectedContactId: number;

  @IsString()
  selectedContactHubspotId: string;

  @IsObject()
  updatedData: Record<string, any>;

  @IsArray()
  @IsInt({ each: true })
  removedIds: number[];

  @IsArray()
  allContactsData: any[];

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  updateHubSpot?: boolean = true;
}

export class FinishProcessDto {
  @IsString()
  apiKey: string;
}

export class ResetMergeDto {
  @IsInt()
  groupId: number;

  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

export class RemoveContactDto {
  @IsInt()
  contactId: number;

  @IsInt()
  groupId: number;

  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

export class MergeContactsDto {
  @IsInt()
  groupId: number;

  @IsString()
  @IsNotEmpty()
  primaryAccountId: string;

  @IsNotEmpty()
  secondaryAccountId: string | string[];

  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

export class BatchMergeContactsDto {
  @IsInt()
  groupId: number;

  @IsString()
  @IsNotEmpty()
  primaryAccountId: string;

  @IsArray()
  @IsString({ each: true })
  secondaryAccountIds: string[];

  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

export class ResetMergeByGroupDto {
  @IsInt()
  groupId: number;

  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

export class DeleteActionDto {
  @IsInt()
  actionId: number;

  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

export class UpdateContactDto {
  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsObject()
  @IsNotEmpty()
  fields: Record<string, any>;
}
