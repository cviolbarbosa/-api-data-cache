
export const hashCode = (str) => {
  return str.split('').reduce((prevHash, currVal) =>
      // tslint:disable-next-line:no-bitwise
      (((prevHash << 5) - prevHash) + currVal.charCodeAt(0)) | 0, 0);
};


export const urlJoin = (...args) =>
  args
    .join('/')
    .replace(/[\/]+/g, '/')
    .replace(/^(.+):\//, '$1://')
    .replace(/^file:/, 'file:/')
    .replace(/\/(\?|&|#[^!])/g, '$1')
    .replace(/\?/g, '&')
    .replace('&', '?');

export function slugify(text) {
  return text.toString().toLowerCase()
      .replace(/\s+/g, '_')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '_')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
}

export function searchDeep(obj, keyOrValue, ignoreLimit = 2000, level = 0, maxLevel = 3) {
  const searchText = keyOrValue.toLowerCase();
  let stringfied: string = '';
  let match: boolean = false;
  for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
          if (key === keyOrValue) { return true; }
          try {

              switch (typeof(obj[key])) {
                  case 'string':
                      const dateReg = /^\d{4}([./-])\d{2}\1\d{2}/;
                      if (obj[key].match(dateReg)) {
                          stringfied = (new Date(obj[key]).toLocaleString('en-US'));
                      } else {
                          stringfied = obj[key];
                      }
                  break;

                  case 'number':
                      stringfied = JSON.stringify(obj[key]);
                  break;

                  case 'object':
                      if (level < maxLevel) {
                          level = level + 1;
                          if (searchDeep(obj[key], keyOrValue, ignoreLimit, level, maxLevel)) {
                              return true;
                          } else {
                              continue;
                          }
                      } else {
                          continue;
                      }

                  break;

                  default:
                      break;
              }
          } catch (error) {
              continue;
          }
          if (stringfied && stringfied.length < ignoreLimit) {
              match = stringfied.toLowerCase().includes(searchText);
          }
          if (match) {return true; }
      }
  }

  return match;
}