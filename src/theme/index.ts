export const colors = {
  bg: "#F4F6FA",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF1F6",
  border: "#DDE2EB",
  text: "#1A1F2B",
  textMuted: "#667085",
  textFaint: "#98A2B3",
  primary: "#0E4DA4",
  primaryDark: "#0A3A7E",
  primarySoft: "#E6EEFA",
  onPrimary: "#FFFFFF",
  /** Price / emphasis colour. */
  gold: "#D9680F",
  /** Age-rating badge orange. */
  accent: "#F58220",
  success: "#12803C",
  warning: "#B45309",
  danger: "#D92D20",
  // Seats
  seatAvailable: "#FFFFFF",
  seatAvailableBorder: "#B8C2D4",
  seatVip: "#FFF1E3",
  seatVipBorder: "#F58220",
  seatCouple: "#FDE8F1",
  seatCoupleBorder: "#DB2777",
  seatBooked: "#D5DAE3",
  seatSelected: "#0E4DA4",
  seatMine: "#F5B841",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const font = {
  size: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
} as const;

/** Soft elevation used by cards and the floating tab bar. */
export const shadow = {
  shadowColor: "#0B1B3A",
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;
