import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from './payment.entity';
import { PlanType } from './plan.entity';

@Entity()
export class UserPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'enum', enum: PlanType })
  planType: PlanType;

  @Column({ type: 'timestamp' })
  activationDate: Date;

  @Column({ default: 0 })
  mergeGroupsUsed: number;

  @Column({ default: 0 })
  contactCount: number;

  @Column({ type: 'timestamp', nullable: true })
  billingEndDate: Date;

  @Column({ default: 'active' })
  paymentStatus: string;

  @ManyToOne(() => Payment, { nullable: true })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ nullable: true })
  paymentId: number;
}
