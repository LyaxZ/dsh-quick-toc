/**
 * dsh-quick-toc host half.
 *
 * One job: register the `dsh-quick-toc` settings namespace so the panel's
 * preferences live in the Host settings document and the plugin gets a card in
 * Settings → Plugins → Plugin configuration. The browser half owns both the
 * card and the panel; nothing here consumes the values.
 *
 * The composition entry is the base layer, so a value the user clears falls
 * back to the schema defaults rather than to nothing.
 *
 * @module dsh-quick-toc
 */
import z from "@deepseek-ai/schemastery";

/** Namespace the browser half binds and the card is keyed on. */
export const NAMESPACE = "dsh-quick-toc";

/**
 * The durable settings section. Values are written by the browser half's card
 * (and by the panel itself), so the schema is the validation layer, not a form.
 */
export const Config = z.object({
  lang: z
    .string()
    .pattern(/^(auto|zh|en)$/)
    .default("auto")
    .description("Panel language: auto follows DSH, zh or en forces one"),
  dock: z
    .string()
    .pattern(/^(left|right)$/)
    .default("left")
    .description("Which edge the panel docks to by default"),
  levels: z
    .array(z.number().min(1).max(6))
    .default([1, 2, 3, 4, 5, 6])
    .description("Heading levels the outline shows"),
  fuzzy: z
    .boolean()
    .default(false)
    .description("Start with fuzzy search on"),
  hover: z
    .boolean()
    .default(true)
    .description("Show the hover preview card"),
  debug: z
    .boolean()
    .default(false)
    .description("Print the mount diagnostic to the browser console"),
});

/**
 * Register the settings section. The values themselves are read and written by
 * the browser half through the client settings scope.
 * @param {object} ctx - host cordis context.
 * @param {object} [config] - the plugin entry's composition config (base layer).
 */
export function apply(ctx, config) {
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NAMESPACE, Config, config ?? {}, {
      setSource: () => {},
      onChange: () => {},
    });
  });
}
