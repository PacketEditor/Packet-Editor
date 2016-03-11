// we need this for communication with the background script
try {
  var tabId = chrome.devtools.inspectedWindow.tabId;
  var port = chrome.extension.connect({name: "INSPECT"});
  function setupPort() {
      port.onMessage.addListener(function(x) {
          debugger;
      });
      port.onDisconnect.addListener(function(x) {
          port = chrome.extension.connect({name: "INSPECT"});
          setupPort();
      });
  }
} catch(e) {
  console.log('running in demo mode');
  var tabId = 0;
  var port = {};
  port.postMessage = function(e) {
    console.log("port.postMessage");
    console.log(e);
  }
}


var appDetected = false;
function appNotFound() {
  console.log('companion app not found, checking again in 2 seconds...');
  document.getElementById('applink').style.display = 'block';
  setTimeout(checkForApp, 2000);
}
function appFound() {
  console.log('companion app found');
  appDetected = true;
  document.getElementById('applink').style.display = 'none';
}
// since the app is a rudimentary webserver on port 36021, we check if it's
// running by sending it a "hello" request and verifying the response
function checkForApp() {
    if (appDetected) {
      appFound();
    }
    var xmp = new XMLHttpRequest();
    var timeout;
    xmp.open("GET", "http://127.0.0.1:36021/hello", true);
    xmp.onreadystatechange = function() {
      if (xmp.readyState == 4) {
        clearTimeout(timeout);
        if (xmp.responseText != 'Hello') {
          appNotFound();
        } else {
          appFound();
        }
      }
    };
    timeout = setTimeout(appNotFound, 100);
    xmp.send();
}


onload = function() {
  checkForApp();
  //~ document.getElementById('appurl').onclick = function(e) {
    //~ port.postMessage({action: 'showStore'});
  //~ };

  // define the features
  var features = [
      { 'category': 'blockReroute',
        'sidebar': 'Block / Reroute Requests',
        'title': 'Block Requests / Edit Resources',
        'description': 'Block or reroute requests',
      },
      { 'category': 'requestHeaders',
        'sidebar': 'Request Headers',
        'title': 'Modify Request Headers',
        'description': 'Alter HTTP headers on outgoing requests',
      },
      { 'category': 'responseHeaders',
        'sidebar': 'Response Headers',
        'title': 'Modify Response Headers',
        'description': 'Alter HTTP headers in incoming requests',
      },
      { 'category': 'interceptPost',
        'sidebar': 'Forms / XHR Requests',
        'title': 'Inspect and Edit Forms and XHR requests',
        'description': 'View or alter data sent in POST / Ajax requests'
      },
      { 'category': 'monitorPostMessage',
        'sidebar': 'Monitor PostMessages',
        'title': 'Monitor PostMessages',
        'description': 'View PostMessages as they happen, pausing execution ' +
            'in the JavaScript debugger'
      }
  ];

  var sidebar = document.getElementById('sidebar');
  var sidebar_ul = document.getElementById('sidebar_ul');
  var main = document.getElementById('main');
  var selectedFeature = 0;

  // for selecting one of the sidebar entries and showing its options in the
  // main pane
  var selectOption = function(elem) {
    features[selectedFeature].sb_clickable.classList.remove('active');
    features[selectedFeature].optionsPane.classList.remove('active');
    selectedFeature = elem.getAttribute('data-number');
    features[selectedFeature].sb_clickable.classList.add('active');
    features[selectedFeature].optionsPane.classList.add('active');
  }

  // for enabling one of the sidebar entries when its checkbox is clicked
  var enableOption = function(elem) {
    var number = elem.getAttribute('data-number');
    if (elem.checked) {
      features[number].sb_clickable.classList.add('enabled');
      features[number].optionsPane.classList.add('enabled');
    } else {
      features[number].sb_clickable.classList.remove('enabled');
      features[number].optionsPane.classList.remove('enabled');
    }
  }

  for (var i = 0; i < features.length; i++) {
    var category = features[i].category;

    // create sidebar elements
    var li = document.createElement('li');
    var clickable = document.createElement('a');
    var checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.setAttribute('data-number', i);
    checkbox.setAttribute('data-category', features[i].category);
    clickable.appendChild(checkbox);
    clickable.insertAdjacentText('beforeend', features[i].sidebar);
    clickable.setAttribute('data-number', i);
    li.appendChild(clickable);
    sidebar_ul.appendChild(li);

    // create main area elements
    var optionsPane = document.createElement('div');
    var title = document.createElement('h1');
    var description = document.createElement('span');
    description.className = 'description';
    description.innerText = features[i].description;
    title.innerText = features[i].title;
    optionsPane.appendChild(title);
    optionsPane.appendChild(description);
    main.appendChild(optionsPane);

    features[i].sb_li  = li;
    features[i].sb_clickable = clickable;
    features[i].sb_checkbox = checkbox;
    features[i].optionsPane = optionsPane;

    // handle selecting and enabling features
    clickable.onclick = function(e) {
      selectOption(this);
    }
    checkbox.onchange = function(e) {
      enableOption(this);
      port.postMessage({
        tabId: tabId,
        key: this.getAttribute('data-category'),
        value: this.checked});
    }

    // handle options pane
    switch (features[i].category) {
      case 'blockReroute':
        //~ var optPane = document.createElement('div');
        //~ optPane.className = 'optionsPane';
        //~ optPane.appendChild(createIgnoreOptions(features[i].category));
        //~ optionsPane.appendChild(optPane);
        //~ optPane = document.createElement('div');
        //~ optPane.className = 'optionsPane';
        //~ optPane.appendChild(createIgnoreOptions(features[i].category, [
          //~ {type: 'modify-script', text: 'Edit javascript'},
          //~ {type: 'modify-stylesheet', text: 'Edit stylesheets'}]));
        //~ optionsPane.appendChild(optPane);
        break;
      case 'requestHeaders':
      case 'responseHeaders':
        var optPane = document.createElement('div');
        optPane.className = 'optionsPane';
        optPane.appendChild(createIgnoreOptions(features[i].category));
        optionsPane.appendChild(optPane);
        break;
    }

  }
  selectOption(features[selectedFeature].sb_clickable);
};

// for creating sub-options checkboxes
var createIgnoreOptions = function(section, options) {
  if (!options) {
    options = [];
  }
  var result = document.createElement('div');
  for (var i=0; i<options.length; i++) {
    var lbl = document.createElement('label');
    var chk = document.createElement('input');
    lbl.appendChild(chk);
    lbl.insertAdjacentText('beforeend', options[i].text);
    chk.setAttribute('type', 'checkbox');
    chk.setAttribute('data-number', i);
    chk.onchange = function(e) {
      var message = {
        tabId: tabId,
        key: "subconf",
        parent: section,
        option: options[this.getAttribute('data-number')].type,
        value: this.checked
      };
      port.postMessage(message);
    }
    //port.postMessage = message;
    result.appendChild(lbl);
  }
  return result;
}


