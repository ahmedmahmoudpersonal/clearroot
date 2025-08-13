import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Remove } from '../entities/remove.entity';
import { Contact } from '../entities/contact.entity';
import { User } from '../entities/user.entity';
import { Matching } from '../entities/matching.entity';

@Injectable()
export class RemovalService {
  constructor(
    @InjectRepository(Remove)
    private removeRepository: Repository<Remove>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Matching)
    private matchingRepository: Repository<Matching>,
  ) {}

  async addContactToRemoveTable(
    userId: number,
    contactId: number,
    groupId: number,
    apiKey: string,
  ) {
    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate contact exists
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, user: { id: userId }, apiKey },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Check if contact is already in remove table
    const existingRemove = await this.removeRepository.findOne({
      where: { contactId, userId, apiKey },
    });

    if (existingRemove) {
      throw new BadRequestException('Contact is already marked for removal');
    }

    try {
      // Add the contact to the remove table
      const removeRecord = this.removeRepository.create({
        contactId,
        userId,
        apiKey,
        groupId,
      });

      await this.removeRepository.save(removeRecord);

      return {
        success: true,
        message: 'Contact marked for removal successfully',
        removeId: removeRecord.id,
        contactId,
        groupId,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to mark contact for removal: ${error.message}`,
      );
    }
  }

  async getRemovalHistory(userId: number, apiKey?: string) {
    const whereCondition: any = { userId };
    if (apiKey) {
      whereCondition.apiKey = apiKey;
    }

    const removals = await this.removeRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });

    return removals;
  }

  async getRemovalById(userId: number, removeId: number) {
    const removal = await this.removeRepository.findOne({
      where: { id: removeId, userId },
    });

    if (!removal) {
      throw new NotFoundException('Removal record not found');
    }

    return removal;
  }

  async undoRemoval(userId: number, removeId: number) {
    const removal = await this.getRemovalById(userId, removeId);

    // Remove the record from the remove table
    await this.removeRepository.delete({ id: removeId });

    // Optionally, add the contact back to the matching group
    if (removal.groupId) {
      const matchingGroup = await this.matchingRepository.findOne({
        where: { id: removal.groupId, userId, apiKey: removal.apiKey },
      });

      if (matchingGroup && !matchingGroup.group.includes(removal.contactId)) {
        matchingGroup.group.push(removal.contactId);
        await this.matchingRepository.save(matchingGroup);
      }
    }

    return {
      success: true,
      message: 'Contact removal undone successfully',
      contactId: removal.contactId,
      groupId: removal.groupId,
    };
  }

  async getContactsMarkedForRemoval(userId: number, apiKey: string) {
    const removals = await this.removeRepository.find({
      where: { userId, apiKey },
      order: { createdAt: 'ASC' },
    });

    return {
      count: removals.length,
      contacts: removals,
    };
  }

  async clearRemovalHistory(userId: number, apiKey: string) {
    const result = await this.removeRepository.delete({ userId, apiKey });

    return {
      success: true,
      message: `Cleared ${result.affected || 0} removal record(s)`,
      deletedCount: result.affected || 0,
    };
  }
}
