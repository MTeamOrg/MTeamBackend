import type { MemberRepositoryPort, MemberListResult } from "../repository/member-repository.js";
import type { MemberListQueryInput } from "../validator/member-validator.js";

export class MemberService {
  constructor(private readonly memberRepository: MemberRepositoryPort) {}

  listMembers(query: MemberListQueryInput, now = new Date()): Promise<MemberListResult> {
    return this.memberRepository.listMembers(query, now);
  }
}
