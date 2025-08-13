import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('remove')
@Index(['userId', 'apiKey'])
export class Remove {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'contact_id' })
  contactId: number;

  @Column({ name: 'api_key' })
  apiKey: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'group_id', nullable: true })
  groupId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
