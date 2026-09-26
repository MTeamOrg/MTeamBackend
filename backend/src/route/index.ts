import { Router } from "express";

import { database } from "../config/database.js";
import { environment } from "../config/environment.js";
import { AdminUserController } from "../controller/admin-user-controller.js";
import { AuthController } from "../controller/auth-controller.js";
import { BranchController } from "../controller/branch-controller.js";
import { MemberController } from "../controller/member-controller.js";
import { MemberMembershipController } from "../controller/member-membership-controller.js";
import { MedicalCertificateController } from "../controller/medical-certificate-controller.js";
import { MembershipPriceController } from "../controller/membership-price-controller.js";
import { PaymentController } from "../controller/payment-controller.js";
import { PaymentPreviewController } from "../controller/payment-preview-controller.js";
import { ScheduledClassController } from "../controller/scheduled-class-controller.js";
import { WeeklyScheduleController } from "../controller/weekly-schedule-controller.js";
import { TrainerController } from "../controller/trainer-controller.js";
import { UserController } from "../controller/user-controller.js";
import { createAuthenticationMiddleware } from "../middleware/authentication-middleware.js";
import { requirePasswordChangeCompleted } from "../middleware/password-change-middleware.js";
import { uploadProfilePhoto } from "../middleware/profile-photo-upload-middleware.js";
import { BranchRepository } from "../repository/branch-repository.js";
import { MemberRepository } from "../repository/member-repository.js";
import { MemberMembershipRepository } from "../repository/member-membership-repository.js";
import { MedicalCertificateRepository } from "../repository/medical-certificate-repository.js";
import { MembershipPriceRepository } from "../repository/membership-price-repository.js";
import { PaymentRepository } from "../repository/payment-repository.js";
import { PaymentPreviewRepository } from "../repository/payment-preview-repository.js";
import { ScheduledClassRepository } from "../repository/scheduled-class-repository.js";
import { WeeklyScheduleRepository } from "../repository/weekly-schedule-repository.js";
import { TrainerRepository } from "../repository/trainer-repository.js";
import { UserRepository } from "../repository/user-repository.js";
import { AdminUserService } from "../service/admin-user-service.js";
import { AuthService } from "../service/auth-service.js";
import { BranchService } from "../service/branch-service.js";
import { MemberService } from "../service/member-service.js";
import { MemberMembershipService } from "../service/member-membership-service.js";
import { MedicalCertificateService } from "../service/medical-certificate-service.js";
import { MembershipPriceService } from "../service/membership-price-service.js";
import { PaymentService } from "../service/payment-service.js";
import { PaymentPreviewService } from "../service/payment-preview-service.js";
import { ScheduledClassService } from "../service/scheduled-class-service.js";
import { WeeklyScheduleService } from "../service/weekly-schedule-service.js";
import { TrainerService } from "../service/trainer-service.js";
import { PasswordService } from "../service/password-service.js";
import { SupabaseProfilePhotoStorage } from "../service/profile-photo-storage.js";
import { SupabaseMedicalCertificateStorage } from "../service/medical-certificate-storage.js";
import { TokenService } from "../service/token-service.js";
import { UserService } from "../service/user-service.js";
import { createAdminUserRouter } from "./admin-user-route.js";
import { createAuthRouter, createProtectedAuthRouter } from "./auth-route.js";
import { createBranchRouter } from "./branch-route.js";
import { createMemberRouter } from "./member-route.js";
import { healthRouter } from "./health-route.js";
import { createMemberMembershipRouter } from "./member-membership-route.js";
import { createMedicalCertificateRouter } from "./medical-certificate-route.js";
import { createMembershipPriceRouter } from "./membership-price-route.js";
import { createPaymentRouter } from "./payment-route.js";
import { createPaymentPreviewRouter } from "./payment-preview-route.js";
import { createScheduledClassRouter } from "./scheduled-class-route.js";
import { createWeeklyScheduleRouter } from "./weekly-schedule-route.js";
import { createTrainerRouter } from "./trainer-route.js";
import { createUserRouter } from "./user-route.js";

export const apiRouter = Router();

const userRepository = new UserRepository(database);
const passwordService = new PasswordService();
const tokenService = new TokenService(environment.JWT_SECRET, environment.JWT_EXPIRES_IN);
const authService = new AuthService(userRepository, passwordService, tokenService);
const authController = new AuthController(authService);
const adminUserService = new AdminUserService(userRepository, passwordService);
const adminUserController = new AdminUserController(adminUserService);
const profilePhotoStorage = new SupabaseProfilePhotoStorage({
  url: environment.SUPABASE_URL,
  serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
  bucket: environment.SUPABASE_PROFILE_PHOTO_BUCKET,
});
const userService = new UserService(userRepository, profilePhotoStorage);
const userController = new UserController(userService);
const authenticate = createAuthenticationMiddleware(tokenService, userRepository);
const branchController = new BranchController(new BranchService(new BranchRepository(database)));
const memberController = new MemberController(new MemberService(new MemberRepository(database)));
const priceRepository = new MembershipPriceRepository(database);
const memberMembershipRepository = new MemberMembershipRepository(database);
const memberMembershipController = new MemberMembershipController(
  new MemberMembershipService(memberMembershipRepository, priceRepository),
);
const membershipPriceController = new MembershipPriceController(
  new MembershipPriceService(priceRepository),
);
const paymentController = new PaymentController(new PaymentService(new PaymentRepository(database)));
const paymentPreviewController = new PaymentPreviewController(
  new PaymentPreviewService(new PaymentPreviewRepository(database), priceRepository),
);
const trainerController = new TrainerController(new TrainerService(new TrainerRepository(database)));
const scheduledClassController = new ScheduledClassController(
  new ScheduledClassService(new ScheduledClassRepository(database)),
);
const weeklyScheduleController = new WeeklyScheduleController(
  new WeeklyScheduleService(new WeeklyScheduleRepository(database)),
);
const medicalCertificateController = new MedicalCertificateController(
  new MedicalCertificateService(
    new MedicalCertificateRepository(database),
    memberMembershipRepository,
    new SupabaseMedicalCertificateStorage({
      url: environment.SUPABASE_URL,
      serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
      bucket: environment.SUPABASE_STORAGE_BUCKET,
    }),
  ),
);

apiRouter.use(healthRouter);
apiRouter.use(createTrainerRouter(trainerController));
apiRouter.use(createAuthRouter(authController));
apiRouter.use(createProtectedAuthRouter(authController, authenticate));
apiRouter.use(createUserRouter(
  userController,
  authenticate,
  requirePasswordChangeCompleted,
  uploadProfilePhoto,
));
apiRouter.use(
  createAdminUserRouter(
    adminUserController,
    authenticate,
    requirePasswordChangeCompleted,
  ),
);
apiRouter.use(createBranchRouter(branchController, authenticate, requirePasswordChangeCompleted));
apiRouter.use(createMemberRouter(memberController, authenticate, requirePasswordChangeCompleted));
apiRouter.use(createMemberMembershipRouter(
  memberMembershipController,
  authenticate,
  requirePasswordChangeCompleted,
));
apiRouter.use(createMembershipPriceRouter(
  membershipPriceController,
  authenticate,
  requirePasswordChangeCompleted,
));
apiRouter.use(createPaymentRouter(paymentController, authenticate, requirePasswordChangeCompleted));
apiRouter.use(createPaymentPreviewRouter(
  paymentPreviewController,
  authenticate,
  requirePasswordChangeCompleted,
));
apiRouter.use(createScheduledClassRouter(
  scheduledClassController,
  authenticate,
  requirePasswordChangeCompleted,
));
apiRouter.use(createWeeklyScheduleRouter(
  weeklyScheduleController,
  authenticate,
  requirePasswordChangeCompleted,
));
apiRouter.use(createMedicalCertificateRouter(
  medicalCertificateController,
  authenticate,
  requirePasswordChangeCompleted,
));
