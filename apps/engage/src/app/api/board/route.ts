import { NextResponse } from "next/server";
import { prBoard } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET() {
  return NextResponse.json(await prBoard());
}
