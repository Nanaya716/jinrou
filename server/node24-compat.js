const http = require('http');

function toHeaderObject(headers) {
  const result = {};
  Object.keys(headers).forEach(key => {
    result[key.toLowerCase()] = headers[key];
  });
  return result;
}

function installLegacyResponseHeaderCompat() {
  const proto = http.ServerResponse.prototype;

  if (!Object.prototype.hasOwnProperty.call(proto, '_headers')) {
    Object.defineProperty(proto, '_headers', {
      configurable: true,
      get() {
        return toHeaderObject(this.getHeaders());
      },
    });
  }

  if (!Object.prototype.hasOwnProperty.call(proto, '_headerNames')) {
    Object.defineProperty(proto, '_headerNames', {
      configurable: true,
      get() {
        const names = {};
        Object.keys(this.getHeaders()).forEach(name => {
          names[name.toLowerCase()] = name;
        });
        return names;
      },
    });
  }
}

installLegacyResponseHeaderCompat();
