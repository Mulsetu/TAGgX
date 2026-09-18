export const LANDING_FAQS = [
  {
    question: "What is an asset management system?",
    answer:
      "An asset management system keeps a live register of equipment — where it is, who owns it, and what happened to it. TagX is Mulsetu's asset management system: every record opens from a QR tag on the unit.",
  },
  {
    question: "What is TagX?",
    answer:
      "TagX is Mulsetu's asset management system. It gives every organization a private workspace to register assets, print QR tags, track locations, run physical audits, and raise maintenance tickets.",
  },
  {
    question: "Is TagX a Mulsetu product?",
    answer:
      "Yes. TagX is designed, shipped, and maintained by Mulsetu — the same team behind Mulsetu's software and AI products. The TagX name, mark, and product stay TagX; Mulsetu is the company behind it.",
  },
  {
    question: "How does white-labeling work?",
    answer:
      "When you create a workspace you pick a unique slug such as acme. Your team signs in at /acme/login. Upload your logo and brand colors so login, sidebar, and tags show your company — not a generic screen.",
  },
  {
    question: "How is TagX priced?",
    answer:
      "Plans are billed monthly in INR through Razorpay and are capped by how many assets you need. Prices and limits are set by the TagX platform, not hardcoded. You can buy extra asset packs later from Settings.",
  },
  {
    question: "Who is TagX for?",
    answer:
      "Operations, facilities, IT, and plant teams that still track equipment in spreadsheets — factories, campuses, hospitals, warehouses, and field-service companies that need a scan-to-record system with their own brand.",
  },
] as const;

export const CAPABILITIES = [
  {
    index: "01",
    title: "QR asset tags",
    body: "Register every asset once, print a TagX QR label, and open the live record from a phone scan — photos, fields, and history included.",
  },
  {
    index: "02",
    title: "Locations that stay honest",
    body: "Move assets between sites, floors, and rooms without losing the trail. Location is part of the record, not a cell in a sheet.",
  },
  {
    index: "03",
    title: "Maintenance tickets",
    body: "Raise work from the asset page, assign it, and close it against the same tag so breakdowns are not tribal knowledge.",
  },
  {
    index: "04",
    title: "Physical audits",
    body: "Walk the floor, scan what is there, and see what is missing. Audit sessions replace clipboard counts.",
  },
  {
    index: "05",
    title: "Roles and permissions",
    body: "Admins, technicians, and auditors each see the right screens. Tenant data stays isolated with row-level security.",
  },
  {
    index: "06",
    title: "White-label workspaces",
    body: "Your slug, your logo, your colors. TagX runs underneath; your team sees your brand.",
  },
] as const;

export const PRODUCT_SHOTS = [
  {
    src: "/marketing/tagx-dashboard-hero.png",
    alt: "TagX dashboard with asset totals, warranty alerts, and category charts",
    title: "Operations dashboard",
    body: "See missing units, overdue work, and warranty risk in one workspace — not a pile of spreadsheets.",
  },
  {
    src: "/marketing/tagx-asset-register.png",
    alt: "TagX asset register with codes, locations, status, and photos",
    title: "Searchable asset register",
    body: "Filter by location, status, and custodian. Every row opens the live record behind the QR tag.",
  },
  {
    src: "/marketing/tagx-floor-audit.png",
    alt: "TagX floor audit with scan progress and a phone QR scanner",
    title: "Walk-the-floor audits",
    body: "Scan what is there, flag what is missing, and close the session before the clipboard gets lost.",
  },
  {
    src: "/marketing/tagx-maintenance.png",
    alt: "TagX maintenance tickets with priorities and due dates",
    title: "Tickets on the same tag",
    body: "Raise, assign, and close work against the asset so repair history is not buried in email.",
  },
] as const;
