import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { isAnonymousSupabaseUserClaims } from "@kingstack/shared";
import { JwtAuthGuard } from "../auth/guards/jwt.auth.guard";
import { PermanentUserGuard } from "../auth/guards/permanent-user.guard";
import { TokenBucketLimiter } from "../realtime/presence/rate-limiter";
import { CheckboxesService } from "./checkboxes.service";

export interface CreateCheckboxDto {
  index: number;
  checked: boolean;
}

export interface UpdateCheckboxDto {
  checked: boolean;
}

const CHECKBOX_COUNT = 200;
const GUEST_MUTATIONS_PER_SECOND = 8;
const GUEST_MUTATION_BURST = 16;

@Controller("checkboxes")
export class CheckboxesController {
  private readonly guestMutationLimiter = new TokenBucketLimiter({
    ratePerSecond: GUEST_MUTATIONS_PER_SECOND,
    burst: GUEST_MUTATION_BURST,
  });

  constructor(private readonly checkboxesService: CheckboxesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getCheckboxes() {
    return this.checkboxesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createCheckbox(@Req() request: FastifyRequest, @Body() body: unknown) {
    this.assertGuestMutationAllowed(request);
    return this.checkboxesService.create(validateCreateCheckbox(body));
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  async updateCheckbox(
    @Param("id") id: string,
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    this.assertGuestMutationAllowed(request);
    return this.checkboxesService.update(id, validateUpdateCheckbox(body));
  }

  @Delete(":id")
  @UseGuards(PermanentUserGuard)
  async deleteCheckbox(@Param("id") id: string) {
    await this.checkboxesService.remove(id);
    return { id };
  }

  @Post("bootstrap")
  @UseGuards(JwtAuthGuard)
  async bootstrapCheckboxes(
    @Req() request: FastifyRequest,
    @Query("count") count?: string,
  ) {
    this.assertGuestMutationAllowed(request);
    return this.checkboxesService.ensureCheckboxes(validateCount(count));
  }

  @Post("initialize")
  @UseGuards(PermanentUserGuard)
  async initializeCheckboxes(@Query("count") count?: string) {
    return this.checkboxesService.initializeCheckboxes(validateCount(count));
  }

  private assertGuestMutationAllowed(request: FastifyRequest): void {
    const claims = request.user;
    if (!claims || !isAnonymousSupabaseUserClaims(claims)) return;

    if (!this.guestMutationLimiter.allow(claims.sub)) {
      throw new HttpException(
        "Guest checkbox mutation rate exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

export function validateCreateCheckbox(value: unknown): CreateCheckboxDto {
  const input = asRecord(value);
  if (
    !input ||
    !Number.isInteger(input.index) ||
    (input.index as number) < 0 ||
    (input.index as number) >= CHECKBOX_COUNT ||
    typeof input.checked !== "boolean"
  ) {
    throw new BadRequestException(
      `Checkbox creation requires an integer index from 0 to ${CHECKBOX_COUNT - 1} and a boolean checked value`,
    );
  }
  return { index: input.index as number, checked: input.checked };
}

export function validateUpdateCheckbox(value: unknown): UpdateCheckboxDto {
  const input = asRecord(value);
  if (!input || typeof input.checked !== "boolean") {
    throw new BadRequestException(
      "Checkbox updates require a boolean checked value",
    );
  }
  return { checked: input.checked };
}

export function validateCount(value?: string): number {
  if (value === undefined) return CHECKBOX_COUNT;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > CHECKBOX_COUNT) {
    throw new BadRequestException(
      `Checkbox count must be an integer from 1 to ${CHECKBOX_COUNT}`,
    );
  }
  return count;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
