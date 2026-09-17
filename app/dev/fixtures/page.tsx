import { notFound } from "next/navigation";
import { sampleCandidates, sampleProfile } from "@/fixtures/profile.sample";
import { devFeaturesEnabled } from "@/lib/devOnly";
import { FixturesWorkbench } from "./workbench";

/**
 * DEV/PREVIEW ONLY — P4's workbench: every component from components/profile/* and components/search/*
 * in its interesting states, rendered against fixtures/profile.sample.ts. Returns 404 in production.
 */
export default function FixturesPage() {
  if (!devFeaturesEnabled) notFound();
  return <FixturesWorkbench profile={sampleProfile} candidates={sampleCandidates} />;
}
