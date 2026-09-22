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
 * Mark one preference field as a live value where the running schemastery knows
 * the modifier, and hand the field back untouched where it does not; see
 * `apply` for why the difference exists.
 * @param {object} schema - the field's schema.
 * @returns {object} the same schema, volatile on hosts that support it.
 */
const volatileSchema = (schema) =>
  typeof schema.volatile === "function" ? schema.volatile() : schema;

/**
 * The durable settings section. Values are written by the browser half's card
 * (and by the panel itself), so the schema is the validation layer, not a form.
 */
export const Config = z.object({
  lang: volatileSchema(z
    .string()
    .pattern(/^(auto|zh|en)$/)
    .default("auto")
    .description("Panel language: auto follows DSH, zh or en forces one")),
  dock: volatileSchema(z
    .string()
    .pattern(/^(left|right)$/)
    .default("left")
    .description("Which edge the panel docks to by default")),
  levels: volatileSchema(z
    .array(z.number().min(1).max(6))
    .default([1, 2, 3, 4, 5, 6])
    .description("Heading levels the outline shows")),
  zoom: volatileSchema(z
    .number()
    .min(0.5)
    .max(2)
    .default(1)
    .description("Scale factor for the panel's content (text, icons, buttons) from 50% to 200%; the panel's own size is unchanged")),
  sheetZoom: volatileSchema(z
    .number()
    .min(0.5)
    .max(2)
    .default(1)
    .description("Scale factor for the curtain's content (text, icons, buttons) from 50% to 200%; the curtain's own size is unchanged")),
  handle: volatileSchema(z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .description("Vertical position of the collapsed-panel handle: 0 = bottom, 1 = top of the conversation area")),
  fuzzy: volatileSchema(z
    .boolean()
    .default(false)
    .description("Start with fuzzy search on")),
  hover: volatileSchema(z
    .boolean()
    .default(true)
    .description("Show the hover preview card")),
  remember: volatileSchema(z
    .boolean()
    .default(true)
    .description("Remember where you were reading in each session and return there when it is reopened")),
  autoLoad: volatileSchema(z
    .boolean()
    .default(true)
    .description("Load history automatically when the outline is scrolled into turns that are not loaded yet; off means nothing loads until a row is clicked")),
  debug: volatileSchema(z
    .boolean()
    .default(false)
    .description("Print the mount diagnostic to the browser console")),
});

/**
 * Register the settings namespace, in whichever dialect the running host speaks.
 *
 * Up to DSH 0.1.5-rc.2 the settings service registers a named section with a
 * schema and reads and writes it by that name (`installSection`). From
 * 0.1.7-alpha.1 on, the service addresses settings by PROFILE ENTRY ID, derives
 * the entry's form from the schema this module exports, and only projects the
 * fields marked `.volatile()` — an instance announces its page policy with
 * `settings.configure` instead. Both are pure registrations that the browser
 * half then reads through its own service, so the plugin does not care which
 * one ran.
 *
 * `volatileSchema` marks a field only where the running schemastery knows the
 * modifier: it arrived in schemastery 3.18.3 (the alpha), and calling it on
 * 3.18.2 (the rc line) would throw while the module is being imported.
 *
 * @param {object} ctx - host cordis context.
 * @param {object} [config] - the plugin entry's composition config (base layer).
 */
export function apply(ctx, config) {
  ctx.inject(["settings"], (settingsCtx) => {
    const settings = settingsCtx.settings;
    if (settings && typeof settings.installSection === "function") {
      settings.installSection(ctx, NAMESPACE, Config, config ?? {}, {
        setSource: () => {},
        onChange: () => {},
      });
      return;
    }
    if (settings && typeof settings.configure === "function") {
      // `auto: true` keeps the host's generated page as the fallback wherever no
      // custom page of ours is reachable (the browser half renders one where the
      // host offers a configuration cell for this entry).
      settingsCtx.effect(() => settings.configure({ auto: true }, ctx.fiber));
    }
  });
}
