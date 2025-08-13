import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('merging')
@Index(['userId', 'groupId'])
export class Merging {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'api_key' })
  apiKey: string;

  @Column({ name: 'group_id' })
  groupId: number;

  @Column({ name: 'primary_account_id' })
  primaryAccountId: string;

  @Column({ name: 'secondary_account_id' })
  secondaryAccountId: string;

  @Column({ name: 'merge_status', default: 'completed' })
  mergeStatus: string; // pending, completed, failed

  @Column({ name: 'merged_at', type: 'timestamp', nullable: true })
  mergedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
