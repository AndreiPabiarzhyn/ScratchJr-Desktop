// intl-messageformat's locale-data/* files expect a global `IntlMessageFormat`
// to already exist when they load (old CommonJS `require()` order relied on
// this running first). ES imports are hoisted and resolved in listed order,
// so this must be the first import wherever locale-data files are imported.
import IntlMessageFormat from 'intl-messageformat';

globalThis.IntlMessageFormat = IntlMessageFormat;

export default IntlMessageFormat;
