import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ActionStatus {
  START = 'start',
  FETCHING = 'fetching',
  FILTERING = 'filtering',
  MANUALLY_MERGE = 'manually_merge',
  UPDATE_HUBSPOT = 'update_hubspot',
  FINISHED = 'finished',
  ERROR = 'error',
  RETRYING = 'retrying',
  REMOVE = 'removed',
}

@Entity('actions')
export class Action {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  api_key: string; // This should be encrypted in production

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({
    type: 'enum',
    enum: ActionStatus,
    default: ActionStatus.START,
  })
  status: ActionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  process_name: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  message: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  excel_link: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
