import {
  MemberNotFoundError,
  UserIsNotMemberError,
  type PaymentRepositoryPort,
} from "../../src/repository/payment-repository.js";
import { PaymentService } from "../../src/service/payment-service.js";

const memberId = "f846bcd2-c43f-4c08-a523-515b60b1c8a8";
const administratorId = "75f219ab-e396-40e5-b4cc-af0c516d3345";
const input = { memberId, amount: 12345.67, method: "TRANSFER", receiptNumber: "TEST" };

function setup(rejection?: Error) {
  const createAccreditedPayment = rejection
    ? jest.fn().mockRejectedValue(rejection)
    : jest.fn().mockResolvedValue({ id: "payment-id", amount: { toString: () => "12345.67" } });
  const repository = { createAccreditedPayment } as unknown as PaymentRepositoryPort;
  return { service: new PaymentService(repository), createAccreditedPayment };
}

describe("payment accreditation service", () => {
  test("delegates the validated operation with the responsible administrator", async () => {
    const { service, createAccreditedPayment } = setup();

    await service.createPayment(input, administratorId);

    expect(createAccreditedPayment).toHaveBeenCalledWith(input, administratorId);
  });

  test.each([
    [new MemberNotFoundError(), 404, "NOT_FOUND"],
    [new UserIsNotMemberError(), 400, "VALIDATION_ERROR"],
  ])("maps repository errors without leaking persistence details", async (error, statusCode, code) => {
    await expect(setup(error).service.createPayment(input, administratorId))
      .rejects.toMatchObject({ statusCode, code });
  });
});
