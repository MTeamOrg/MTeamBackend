import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { calculatePaymentExpiresAt } from "../model/payment-expiration.js";
import type { MembershipPriceRepositoryPort } from "../repository/membership-price-repository.js";
import type {
  PaymentPreviewMember,
  PaymentPreviewRepositoryPort,
} from "../repository/payment-preview-repository.js";
import type { CreatePaymentInput } from "../validator/payment-validator.js";

export interface PaymentPreview {
  member: Omit<PaymentPreviewMember, "role">;
  currentPrice: string;
  amount: string;
  method: string;
  receiptNumber: string | null;
  estimatedAccreditedAt: Date;
  estimatedExpiresAt: Date;
}

export class PaymentPreviewService {
  constructor(
    private readonly memberRepository: PaymentPreviewRepositoryPort,
    private readonly priceRepository: Pick<MembershipPriceRepositoryPort, "findCurrentPrice">,
  ) {}

  async previewPayment(input: CreatePaymentInput, now = new Date()): Promise<PaymentPreview> {
    const [member, price] = await Promise.all([
      this.memberRepository.findMemberById(input.memberId),
      this.priceRepository.findCurrentPrice(now),
    ]);
    if (!member) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
    if (member.role !== "MEMBER") {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "El usuario indicado no es socio");
    }
    if (!price) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND,
        "El valor de la cuota no está configurado");
    }

    const { role: _role, ...memberSummary } = member;
    return {
      member: memberSummary,
      currentPrice: price.amount.toString(),
      amount: input.amount.toString(),
      method: input.method,
      receiptNumber: input.receiptNumber ?? null,
      estimatedAccreditedAt: now,
      estimatedExpiresAt: calculatePaymentExpiresAt(now),
    };
  }
}
