import { NextResponse } from "next/server";
import { rules } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json(await rules());
}
