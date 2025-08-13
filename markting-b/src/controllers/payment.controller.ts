// import { Controller, Post, Body } from '@nestjs/common';
// import { PaymentService } from '../services/payment.service';

// @Controller('payments')
// export class PaymentController {
//   constructor(private readonly paymentService: PaymentService) {}

//   @Post('create')
//   async createPayment(
//     @Body() body: { userId: number; amount: number; currency?: string },
//   ) {
//     return await this.paymentService.createPaymentIntent(
//       body.userId,
//       body.amount,
//       body.currency || 'usd',
//     );
//   }

//   // ...webhook, status endpoints
// }
