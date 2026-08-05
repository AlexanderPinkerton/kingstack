export type SetupKind = "draft" | "full";

export interface SetupProfile {
  label: string;
  requiresDocker: boolean;
  totalSteps: number;
  devScript: "dev" | "dev:frontend";
}

const SETUP_PROFILES: Record<SetupKind, SetupProfile> = {
  draft: {
    label: "Frontend draft",
    requiresDocker: false,
    totalSteps: 10,
    devScript: "dev:frontend",
  },
  full: {
    label: "Full stack",
    requiresDocker: true,
    totalSteps: 12,
    devScript: "dev",
  },
};

export function getSetupProfile(kind: SetupKind): SetupProfile {
  return SETUP_PROFILES[kind];
}
