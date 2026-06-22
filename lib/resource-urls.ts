// Public Notion URLs for each resource (SID-70 Phase 4). Keys are the EXACT
// resource names from scenario.json. The end-user "approved" display reads this
// to render the "Open in Notion →" link. Pages are shared "anyone with link can
// view" (no Notion permission writes — link-sharing only, per the locked design).
//
// A missing/empty URL degrades gracefully: the approved line still shows
// "you now have access to <resource>" without a link.
export const RESOURCE_URLS: Record<string, string> = {
  "data warehouse dashboards":
    "https://app.notion.com/p/randomindianguy/data-warehouse-dashboards-3868dc25553e803c88f0f8827bebfc7d",
  "analytics dashboard":
    "https://app.notion.com/p/randomindianguy/analytics-dashboard-3868dc25553e803983fedccf4ef88feb",
  "Q3 strategy plan":
    "https://app.notion.com/p/randomindianguy/Q3-strategy-plan-3868dc25553e803b92ccd4d113d99fa7",
  "Q3 Revenue Models":
    "https://app.notion.com/p/randomindianguy/Q3-Revenue-Models-3868dc25553e8049ab15fd0646b23ebf",
};
