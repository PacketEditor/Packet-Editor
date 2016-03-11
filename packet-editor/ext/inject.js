/*
 * injectPostMessageInjector injects a script into the DOM which displays any
 * PostMessages in the console, and drops to the javascript debugger.
 */
function injectPostMessageInjector(info) {
  console.log('injected');
  chrome.tabs.executeScript(info.tabId, {
    allFrames: true,
    runAt: "document_start",
    code: "("+ (function() {
      if (window.__injectedPostMessageMonitor) return;
        window.__injectedPostMessageMonitor = true;
      onmessage = function(e) {
        console.group("Message sent from " + e.origin + " to " +
            location.origin);
        console.log(e);
        console.log(e.data);
        console.groupEnd();
        debugger;
      };
    }) +")();"
  });
}

/*
 * injextXSSMonitor injects a script into the DOM which searches the dom for
 * any <tcxss> or <tamperchromexss> element, or any elements with a tcxss
 * or tamperchromexss attribute, displaying relevant information in the console.
 */

function injectXSSMonitor(info) {
  chrome.tabs.executeScript(info.tabId, {
    allFrames: true,
    runAt: "document_start",
    code: "("+ (function() {
      function injectFunction() {
        if (window.__injectedXSSMonitor) return;
          window.__injectedXSSMonitor = true;
        var knownXSS = [];
        function handler(val){
          if (arguments.callee.caller.arguments[0] instanceof Event && !val) {
            val = arguments.callee.caller.arguments[0].target;
          }
          if (knownXSS.indexOf(val) > -1) return;
          console.group("XSS detected in " + location.origin);
          console.trace();
          console.group("Location:");
          var framePath = [].join.call(location.ancestorOrigins, " > ");
          if (framePath) {
            console.log(framePath + " > " + location.origin);
          }
            console.log({
              location: location.href,
            referrer: document.referrer,
            name: name});
          if (val) {
            knownXSS.push(val);
            var path = [];
            var cur = val;
            while (cur.parentNode) {
              var label = cur.tagName;
              if (cur.id) {
                label += "#" + cur.id;
              } else if (cur.className) {
                label += "." + cur.className.replace(/\s+/g, '.');
              }
              path.push(label.toLowerCase());
              cur = cur.parentNode;
            }
            console.log(path.reverse().join(" > "));
            if (val.parentNode) {
              console.group("HTML snippet:");
              var parentHtml = val.parentNode.innerHTML || "";
              [].forEach.call(parentHtml.match(
                /.{0,100}(tcxss|tamperchromexss).{0,100}/g) || [], function(
                  match){console.log(match.replace(/^\s*|\s*$/g, ' '));
              });
              console.groupEnd();
            }
            console.log(val);
          }
          console.groupEnd(); // Location
          console.groupEnd(); // XSS
        }
        var identifiers = ["tcxss", "tamperchromexss"];
        identifiers.forEach(function(ident){
          window.__defineGetter__(ident, handler);
          window.__defineSetter__(ident, handler);
        });
        function checkit(e){
          if (!e.target || !e.target.tagName) return;
          if (identifiers.indexOf(e.target.tagName.toLowerCase()) > -1) {
            handler(e.target);
          } else {
            identifiers.forEach(function(ident){
              if (typeof e.target.attributes[ident] != "undefined") {
                handler(e.target);
              }
            });
          }
        }
        function checknow() {
          [].forEach.call(document.getElementsByTagName("*"), function(elem){
            checkit({target: elem});
          });
        }
        document.addEventListener("DOMSubtreeModified", checkit, false);
        setTimeout(checknow, 1);
      }
      var script = document.createElement("a");
      script.setAttribute("onclick", ("("+injectFunction+")();"));
      script.click();
    }) +")();"
  });
}

/*
 * injectInjector injects a script which captures any form submissions or AJAX
 * requests, sending them to the Packet Editor application for modification.
 */
function injectInjector(info) {
  chrome.tabs.executeScript(info.tabId, {
    allFrames: true,
    runAt: "document_start",
    code: "(" + (function (crx) {
      var injectFunction = function (crx) {
        if (window.__injectedInjector) return;
          window.__injectedInjector = true;

        // send the request over to the chrome packaged app for processing
        function askUser(type, data){
          var requestURI = "http://127.0.0.1:36021/start";
          var identifier = Date.now().toString() +
              Math.random().toString().substr(2);
          var params = "request="+encodeURIComponent(identifier) +
            "&type="+encodeURIComponent(type) +
            "&data="+encodeURIComponent(JSON.stringify(data));
          try {
            var xmp = new xhr();
            xmp.open("POST", requestURI, false);
            xmp.send(params);
            result = xmp.responseText;
          } catch (e) {
            console.log(e);
          }
          return result;
        }

        if (typeof window.TAMPER_INSPECT == "undefined") {
          window.TAMPER_INSPECT = true;

          // Capture XMLHttpRequests by replacing window.XMLHttpRequest
          var xhr = window.XMLHttpRequest;
          window.TAMPER_INSPECT_XHR = xhr;
          var super_ = new xhr;
          window.XMLHttpRequest = function() {
            var USER_CONFIRMING = false;
            this.super_ = super_;
            XMLHttpRequest.prototype = super_ = new xhr;
            this.method_ = '';
            this.url_ = '';
            this.async_ = undefined;
            this.data_ = '';
            this.headers_ = [];
            this.headers_index_ = {};
            this.responseHeaders_ = undefined;
            this.responseHeadersText_ = '';
            this.open = function(method, url, async, username, password) {
              USER_CONFIRMING = false;
              this.data_ = '';
              this.headers_ = [];
              this.headers_index_ = {};
              this.responseHeaders_ = undefined;
              this.responseHeadersText_ = '';
              delete this.responseText_;
              var ret = this.super_.open(method, url, async, username, password);
              this.method_ = String(method);
              this.url_ = String(url);
              this.async_ = async;
              return ret;
            }
            this.send = function(data) {
              this.data_ = data;
              var res = JSON.parse(askUser("xhr", {
                  method: this.method_,
                  url: this.url_,
                  async: this.async_,
                  data: this.data_,
                  headers: this.headers_
              }));
              if (res.debug) {
                debugger;
              }
              if (res.cancel) {
                return;
              }
              if (res.modified) {
                  this.super_.open(res.method, res.url, res.async);
                  for (var i = 0; i < res.headers.length; i++) {
                    this.super_.setRequestHeader(
                        res.headers[i].name,res.headers[i].value);
                  }
                  this.super_.send(res.data);
              }
              this.super_.send(arguments[0]);
            };
            this.setRequestHeader = function(header, value) {
              var ret = this.super_.setRequestHeader(header, value);
              var normalized = normalize(header);
              var index = this.headers_index_[normalized];
              if (typeof index == "number") {
                this.headers_[index] = {name: header, value: value};
              } else {
                index = this.headers_.push({name: header, value: value});
                this.headers_index_[normalized] = index;
              }
              return ret;
            };

            // allow the user to also modify the XMLHttpRequest responses
            this.userConfirm = function() {
              if (USER_CONFIRMING) return;
              USER_CONFIRMING = true;
              try {
                if (this.readyState != 4) {
                  USER_CONFIRMING = false;
                  return;
                }
                var ret = JSON.parse(askUser("xhr_response", {
                  responseText: this.responseText,
                  headers: this.getAllResponseHeaders(),
                  status: this.status,
                  readyState: this.readyState,
                  url: this.url_
                }));
                if (ret.cancel) {
                  this.responseText_ = '';
                  this.responseHeaders_ = {};
                  this.responseHeadersText_ = '';
                  this.status_ = undefined;
                }
                if (ret.modified) {
                  this.responseText_ = ret.responseText;
                  this.responseHeaders_ = splitHeaders(ret.headers);
                  this.responseHeadersText_ = ret.headers;
                  this.status_ = ret.status;
                }
                if (ret.debug) {
                  debugger;
                }
              } catch(e) {}
            };
            var me = this;
            function splitHeaders(res) {
              var headers = {};
              res.replace(/(?:^|\n)([^:]*)(?::\ ?)(.*)(?:\n|$)/g, function(
                  _, header, value) {
                headers[normalize(header)] = value;
              });
              return headers;
            }
            function normalize(header) {
              return header.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
            }
            function hijack(property, opt_checker) {
              Object.defineProperty(me, property, {
                configurable: true,
                get: function(){
                  if (!opt_checker || !opt_checker(this.super_[property])) {
                    me.userConfirm();
                  }
                  if (me.hasOwnProperty(property+"_")) {
                    return me[property+"_"];
                  }
                  return this.super_[property];
                }
              });
            }

            hijack("responseText");
            hijack("status");
            hijack("readyState", function(v){
              return v == 4;
            });

            this.getResponseHeader = function(header) {
              this.userConfirm();
              var normalized = normalize(header);
              if (this.responseHeaders_ &&
                  this.responseHeaders_.hasOwnProperty(normalized)) {
                return this.responseHeaders_[normalized];
              }
              return this.super_.getResponseHeader(arguments[0]);
            };
            this.getAllResponseHeaders = function() {
              this.userConfirm();
              if (this.responseHeaders_) {
                return this.responseHeadersText_;
              }
              return this.super_.getAllResponseHeaders();
            };
          };
          window.XMLHttpRequest.prototype = super_;
          window.XMLHttpRequest.toString = function() {
            return "function XMLHttpRequest() { [injected code] }";
          };

          // Capture <form> submissions.
          var submitHandler = function(form) {
            var elems = form.elements;
            var fields = [];
            for (var i = 0; i < elems.length; i++) {
              var elem = elems[i];
              // ignore any non-named elements
              if (!elem.name) {
                continue;
              }
              // ignore non-clicked submit elements
              if (elem.type.toLowerCase() == 'submit' &&
                  elem.form.lastClicked != elem) {
                continue;
              }
              // ignore disabled elements
              if (elem.disabled) {
                continue;
              }
              fields.push({name: elem.name, value: elem.value});
            }
            // if the clicked submit element was an image,include click coords
            if (form.lastClicked instanceof HTMLInputElement &&
                form.lastClicked.type.toLowerCase() == 'image') {
              var prefix = form.lastClicked.name ?
                  form.lastClicked.name + '.' : '';
              fields.push({
                name: prefix + 'x',
                value: form.lastClicked.lastEvent.x,
                readOnly: true});
              fields.push({
                name: prefix + 'y',
                value: form.lastClicked.lastEvent.y,
                readOnly: true});
            }
            // send it off to the application
            var ret = JSON.parse(askUser('form', {
              action: form.action,
              method: form.method,
              fields: fields
            }));
            // user blocked
            if (ret.cancel) {
              return false;
            }
            // apply modifications
            if (ret.modified) {
              this.action = ret.action;
              this.method = ret.method;
              ret.fields.forEach(function(field) {
                if (!field.readOnly) { // skip fields that can't be modified
                  var elem = form.elements[field.name];
                  if (elem) {
                    // we remove parameters by disabling the elem during submit
                    if (field.remove) {
                      elem.disabled = true;
                      setTimeout(function() {
                        elem.disabled = false;
                      }, 1);
                    }
                    // we alter parameters by changing the elem during submit
                    var originalValue = elem.value;
                    elem.value = field.value;
                    setTimeout(function() {
                      elem.value = originalValue;
                    }, 1);
                  } else {
                    // for add parameters with hidden inputs during submit
                    var elem = document.createElement('input');
                    elem.type = 'hidden';
                    elem.name = field.name;
                    elem.value = field.value;
                    form.appendChild(elem);
                    setTimeout(function() {
                      elem.parentNode.removeChild(elem);
                    }, 1);
                  }
                }
              });
            }
            // debugging injection
            if (ret.debug) {
              debugger;
            }
            // continue the submission process
            return true;
          };

          // apply the submit handler to onSubmit and also .submit()
          HTMLFormElement.prototype._tamperChromeRealSubmit =
              HTMLFormElement.prototype.submit;
          HTMLFormElement.prototype.submit = function() {
            if (submitHandler(this)) {
              return this._tamperChromeRealSubmit();
            }
          }
          window.addEventListener('submit', function(e) {
            if (!submitHandler(e.target)) {
              e.preventDefault();
            }
          }, false);

          // track last clicked element and its location within forms (important
          // if the form has multiple submit buttons)
          var trackLast = function(e) {
            var parentForm = e.target;
            do {
              if (parentForm.nodeName.toLowerCase() === 'form') {
                break;
              }
            } while (parentForm = parentForm.parentNode);
            if (!parentForm) {
              return;
            }
            parentForm.lastClicked = e.target;
            parentForm.lastEvent = e;
          };
          window.addEventListener('click', trackLast, true);
          window.addEventListener('keyup', trackLast, true);
          window.addEventListener('keydown', trackLast, true);
        }
        return true;
      }
      var script = document.createElement("script");
      script.appendChild(document.createTextNode(
          "("+injectFunction+")(unescape('"+escape(crx)+"'));"));
      document.documentElement.appendChild(script);
    }) + ")(unescape('" + escape(location.origin) + "'));"
  });
}
