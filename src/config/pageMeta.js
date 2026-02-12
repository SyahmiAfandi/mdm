export const PAGE_META = [
  {
    match: /^\/$/,
    title: "Dashboard",
    breadcrumbs: [{ label: "Home", to: "/" }],
  },

  {
    match: /^\/tools\/?$/,
    title: "Tools",
    breadcrumbs: [{ label: "Home", to: "/" }, { label: "Tools" }],
  },

  {
    match: /^\/utilities\/?$/,
    title: "Utilities",
    breadcrumbs: [{ label: "Home", to: "/" }, { label: "Utilities" }],
  },

  {
    match: /^\/utilities\/emailtracker/,
    title: "Email Tracker",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Utilities", to: "/utilities" },
      { label: "Email Tracker" },
    ],
  },

  {
    match: /^\/utilities\/date-converter/,
    title: "Date Converter",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Utilities", to: "/utilities" },
      { label: "Date Converter" },
    ],
  },

  {
    match: /^\/reports\/?$/,
    title: "Reports",
    breadcrumbs: [{ label: "Home", to: "/" }, { label: "Reports" }],
  },

  {
    match: /^\/reports\/summary_recons/,
    title: "Reconciliation Summary",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reports", to: "/reports" },
      { label: "Reconciliation Summary" },
    ],
  },

  {
    match: /^\/reports\/mismatch-tracker/,
    title: "Mismatch Tracker",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reports", to: "/reports" },
      { label: "Mismatch Tracker" },
    ],
  },

  {
    match: /^\/reports\/matrix_recons/,
    title: "Reconciliation Matrix",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reports", to: "/reports" },
      { label: "Reconciliation Matrix" },
    ],
  },

  {
    match: /^\/reports\/DSS/,
    title: "Daily Sales Summary",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reports", to: "/reports" },
      { label: "Daily Sales Summary" },
    ],
  },

  {
    match: /^\/recons\/?$/,
    title: "Reconciliation",
    breadcrumbs: [{ label: "Home", to: "/" }, { label: "Reconciliation" }],
  },

  {
    match: /^\/recons\/hpc/,
    title: "Reconciliation (HPC)",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reconciliation", to: "/recons" },
      { label: "HPC" },
    ],
  },

  {
    match: /^\/recons\/ic/,
    title: "Reconciliation (IC)",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reconciliation", to: "/recons" },
      { label: "IC" },
    ],
  },

  {
    match: /^\/recons\/upload/,
    title: "Reconciliation Upload",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reconciliation", to: "/recons" },
      { label: "Upload" },
    ],
  },

  {
    match: /^\/recons\/summary/,
    title: "Reconciliation Summary",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reconciliation", to: "/recons" },
      { label: "Summary" },
    ],
  },

  {
    match: /^\/recons\/result/,
    title: "Reconciliation Results",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reconciliation", to: "/recons" },
      { label: "Results" },
    ],
  },

  {
    match: /^\/recons\/custom/,
    title: "Custom Reconciliation",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Reconciliation", to: "/recons" },
      { label: "Custom" },
    ],
  },

  {
    match: /^\/settings\/?$/,
    title: "Settings",
    breadcrumbs: [{ label: "Home", to: "/" }, { label: "Settings" }],
  },

  {
    match: /^\/settings\/admin\/users/,
    title: "Admin Users",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Settings", to: "/settings" },
      { label: "Admin Users" },
    ],
  },

  {
    match: /^\/settings\/admin\/licenses/,
    title: "License Expiry",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Settings", to: "/settings" },
      { label: "License Expiry" },
    ],
  },

  {
    match: /^\/settings\/admin\/permission/,
    title: "Roles & Permissions",
    breadcrumbs: [
      { label: "Home", to: "/" },
      { label: "Settings", to: "/settings" },
      { label: "Roles & Permissions" },
    ],
  },

  {
    match: /^\/contact\/?$/,
    title: "Contact",
    breadcrumbs: [{ label: "Home", to: "/" }, { label: "Contact" }],
  },

  {
    match: /^\/in-progress\/?$/,
    title: "In Progress",
    breadcrumbs: [{ label: "Home", to: "/" }, { label: "In Progress" }],
  },
];
