export type Role = "kommitter" | "founder" | "anon";

export type User = {
  id: string;
  displayName: string;
  role: Role;
  avatarSeed: number;
  email: string;
  wallet: string;
  /** Slug of the project this user owns (founder only) */
  ownsProject?: string;
};

export const USERS: Record<string, User> = {
  lukas: {
    id: "lukas",
    displayName: "Lukas",
    role: "kommitter",
    avatarSeed: 68,
    email: "lukas@example.com",
    wallet: "5x9...kT2",
  },
  julian: {
    id: "julian",
    displayName: "Dr. Julian Vance",
    role: "founder",
    avatarSeed: 12,
    email: "julian@caldera.io",
    wallet: "9p3...mN7",
    ownsProject: "caldera",
  },
  lina: {
    id: "lina",
    displayName: "Lina Park",
    role: "founder",
    avatarSeed: 20,
    email: "lina@marginhouse.org",
    wallet: "Bk2...qX1",
    ownsProject: "margin-house",
  },
};

export function getUser(id: string): User | undefined {
  return USERS[id];
}

export function avatarUrl(seed: number, size = 80): string {
  return `https://i.pravatar.cc/${size}?img=${seed}`;
}
