import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainError } from "@/shared/errors/domain-error";

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Request payload is invalid." } },
      { status: 422 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}
