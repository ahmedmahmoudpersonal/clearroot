import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  apiKey: string;

  @Column()
  userId: number;

  @Column('int')
  amount: number;

  @Column('int', { nullable: true })
  contactCount: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  billingType: string;

  @Column({ default: 'usd' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: 'pending' | 'completed' | 'failed';

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  stripePaymentIntentId: string;

  // originalPrice is stored in cents (integer)
  @Column('int', { nullable: true })
  originalPrice: number;
}
