export const config = {
  APP_NAME: "Datrix",
  APP_DESCRIPTION: "Modern Open-Source Data Control Platform",
  APP_VERSION: "0.1.0",
  LOGO: "/logo.svg",
  THEME: "carbon-amber",
  FEATURES: {
    S3: process.env.ENABLE_S3 !== "false",
    POSTGRES: process.env.ENABLE_POSTGRES !== "false",
    MYSQL: process.env.ENABLE_MYSQL !== "false",
    TEAMS: process.env.ENABLE_TEAMS !== "false",
    LOGS: process.env.ENABLE_LOGS !== "false",
  },
  NAV: [
    { label: "Databases", href: "/dashboard/databases", icon: "Database" },
    { label: "Storage", href: "/dashboard/storage", icon: "HardDrive" },
    { label: "Teams", href: "/dashboard/teams", icon: "Users" },
    { label: "Logs", href: "/dashboard/logs", icon: "ScrollText" },
  ],
};
