// Copied from https://github.com/department-stockholm/aws-signature-v4
// and fixed the sorting of query parameters by using 'query-string' package instead of 'querystring'
import * as crypto from 'crypto';
import * as querystring from 'query-string';

class Signature {

  createCanonicalRequest(method: any, pathname: any, query: any, headers: any, payload: any) {
    return [
      method.toUpperCase(),
      pathname,
      this.createCanonicalQueryString(query),
      this.createCanonicalHeaders(headers),
      this.createSignedHeaders(headers),
      payload
    ].join('\n');
  };

  createCanonicalQueryString(params: any) {
    return Object.keys(params).sort().map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
  };

  createCanonicalHeaders(headers: any) {
    return Object.keys(headers).sort().map(function (name) {
      return name.toLowerCase().trim() + ':' + headers[name].toString().trim() + '\n';
    }).join('');
  };

  createSignedHeaders(headers: any) {
    return Object.keys(headers).sort().map(function (name) {
      return name.toLowerCase().trim();
    }).join(';');
  };

  createCredentialScope(time: any, region: any, service: any) {
    return [this.toDate(time), region, service, 'aws4_request'].join('/');
  };

  createStringToSign(time: any, region: any, service: any, request: any) {
    return [
      'AWS4-HMAC-SHA256',
      this.toTime(time),
      this.createCredentialScope(time, region, service),
      this.hash(request, 'hex')
    ].join('\n');
  };

  createSignature(secret: any, time: any, region: any, service: any, stringToSign: any) {
    var h1 = this.hmac('AWS4' + secret, this.toDate(time), null); // date-key
    var h2 = this.hmac(h1, region, null); // region-key
    var h3 = this.hmac(h2, service, null); // service-key
    var h4 = this.hmac(h3, 'aws4_request', null); // signing-key
    return this.hmac(h4, stringToSign, 'hex');
  };

  createPresignedURL(method: any, host: any, path: any, service: any, payload: any, options: any) {
    options = options || {};
    options.key = options.key || process.env.AWS_ACCESS_KEY_ID;
    options.secret = options.secret || process.env.AWS_SECRET_ACCESS_KEY;
    options.protocol = options.protocol || 'https';
    options.headers = options.headers || {};
    options.timestamp = options.timestamp || Date.now();
    options.region = options.region || process.env.AWS_REGION || 'us-east-1';
    options.expires = options.expires || 86400; // 24 hours
    options.headers = options.headers || {};

    // host is required
    options.headers.Host = host;

    var query = options.query ? querystring.parse(options.query) : {};
    query['X-Amz-Algorithm'] = 'AWS4-HMAC-SHA256';
    query['X-Amz-Credential'] = options.key + '/' + this.createCredentialScope(options.timestamp, options.region, service);
    query['X-Amz-Date'] = this.toTime(options.timestamp);
    query['X-Amz-Expires'] = options.expires;
    query['X-Amz-SignedHeaders'] = this.createSignedHeaders(options.headers);
    if (options.sessionToken) {
      query['X-Amz-Security-Token'] = options.sessionToken;
    }

    var canonicalRequest = this.createCanonicalRequest(method, path, query, options.headers, payload);
    var stringToSign = this.createStringToSign(options.timestamp, options.region, service, canonicalRequest);
    var signature = this.createSignature(options.secret, options.timestamp, options.region, service, stringToSign);
    query['X-Amz-Signature'] = signature;
    const url = options.protocol + '://' + host + path + '?' + querystring.stringify(query);

    return url;
  };

  toTime(time: any) {
    return new Date(time).toISOString().replace(/[:\-]|\.\d{3}/g, '');
  }

  toDate(time: any) {
    return this.toTime(time).substring(0, 8);
  }

  hmac(key: any, string: any, encoding: any) {
    return crypto.createHmac('sha256', key)
      .update(string, 'utf8')
      .digest(encoding);
  }

  hash(string: any, encoding: any) {
    return crypto.createHash('sha256')
      .update(string, 'utf8')
      .digest(encoding);
  }
}

export default Signature;
