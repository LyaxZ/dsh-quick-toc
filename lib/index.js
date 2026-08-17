/**
 * dsh-outline node half. Pure UI plugin: the empty apply exists so the
 * plugin appears in the host loader (load and lifecycle follow the host);
 * the browser half ships via exports["./client"], discovered through the
 * package.json dsh.client declaration.
 */
function apply() {}
export { apply };
