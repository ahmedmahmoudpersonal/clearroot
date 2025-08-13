import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('contacts')
@Index(['email'])
@Index(['phone'])
@Index(['hubspotId'])
export class Contact {
  @Column({ name: 'hs_additional_emails', type: 'text', nullable: true })
  hs_additional_emails?: string;

  @Column({ name: 'other_properties', type: 'json', nullable: true })
  otherProperties?: Record<string, any>;

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'hubspot_id', unique: true })
  hubspotId: string;

  @Column({ nullable: true })
  email: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  company: string;

  @Column({ name: 'create_date', type: 'timestamp', nullable: true })
  createDate: Date;

  @Column({ name: 'last_modified_date', type: 'timestamp', nullable: true })
  lastModifiedDate: Date;

  @Column({ name: 'api_key' })
  apiKey: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
