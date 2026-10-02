/**
 * Host half of dsh-client-ui-quote.
 *
 * The feature lives entirely in the browser: the client module host serves
 * `lib/client.js` for this package and the slotted component installs the
 * floating quote toolbar there. No host service, command, or route is
 * contributed, so this half only marks the loader entry as composed.
 */

function apply() {}

export { apply };
