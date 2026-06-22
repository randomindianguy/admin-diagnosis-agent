// Public Notion URLs for each resource (SID-70 Phase 4). Keys are the EXACT
// resource names from scenario.json. The end-user "approved" display reads this
// to render the "Open in Notion →" link. Pages are shared "anyone with link can
// view" (no Notion permission writes — link-sharing only, per the locked design).
//
// A missing/empty URL degrades gracefully: the approved line still shows
// "you now have access to <resource>" without a link.
export const RESOURCE_URLS: Record<string, string> = {
  "data warehouse dashboards":
    "https://www.notion.so/Data-warehouse-dashboards-3858dc25553e8084890ed3aac0b14c80",
  "analytics dashboard":
    "https://www.notion.so/Analytics-dashboard-3858dc25553e80f4afe2c4f014a59ac9",
  "Q3 strategy plan":
    "https://www.notion.so/Q3-strategy-plan-3858dc25553e80ce81bbeb14b16e9d2b",
  "Q3 Revenue Models":
    "https://www.notion.so/Q3-Revenue-Models-3858dc25553e8076a6acdb4ee59712c6",
};
