// import { Injectable } from '@nestjs/common';
// import Stripe from 'stripe';
// import { Payment } from '../entities/payment.entity';

// @Injectable()
// export class PaymentService {
//   private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//     apiVersion: '2025-06-30.basil', // Use the required Stripe API version
//   });

//   async createPaymentIntent(
//     userId: number,
//     amount: number,
//     currency = 'usd',
//   ): Promise<Payment> {
//     const paymentIntent = await this.stripe.paymentIntents.create({
//       amount: Math.round(amount * 100), // Stripe expects cents
//       currency,
//       metadata: { userId: String(userId) },
//     });
//     return {
//       id: 0,
//       userId,
//       amount,
//       currency,
//       status: 'pending',
//       createdAt: new Date(),
//       stripePaymentIntentId: paymentIntent.id,
//       apiKey: paymentIntent.metadata.apiKey || '',
//       contactCount: 0,
//       billingType: '',
//       originalPrice: 0,
//     };
//   }

//   // ...methods for payment status, webhook handling, etc.
// }
