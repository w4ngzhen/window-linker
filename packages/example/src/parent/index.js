import {WindowLinker} from 'window-linker';

const loadIframeBtn = document.querySelector('#loadIframeBtn');
const openNewWindowBtn = document.querySelector('#openNewWindowBtn');

const actionNameInput = document.querySelector('#actionNameInput');
const dataInput = document.querySelector('#data');
const sendBtn = document.querySelector('#sendBtn');
const responseDataOutput = document.querySelector('#responseData');

const clearContent = () => {
  actionNameInput.value = '';
  dataInput.value = '';
  responseDataOutput.value = '';
  const iframeArea = document.querySelector('.iframe-area');
  iframeArea.innerHTML = '';
};


const windowLinker = new WindowLinker({
  enableDebugLog: true
});
windowLinker.init();

let currentTargetWindow = null;
const targetOrigin = 'http://localhost:8080';

loadIframeBtn.onclick = () => {
  clearContent();
  const iframeArea = document.querySelector('.iframe-area');
  iframeArea.innerHTML = '';

  const iframeEle = document.createElement('iframe');
  iframeEle.src = targetOrigin;
  iframeEle.onload = () => {
    iframeEle.width = iframeArea.clientWidth.toString();
    iframeEle.height = iframeArea.clientHeight.toString();
    currentTargetWindow = iframeEle.contentWindow;
  };

  iframeArea.appendChild(iframeEle);
};

openNewWindowBtn.onclick = () => {
  clearContent();
  currentTargetWindow = window.open(targetOrigin);
};


sendBtn.onclick = async () => {

  // 1. target window
  const targetWindow = currentTargetWindow;
  if (!targetWindow) {
    console.error('targetWindow is empty');
    return;
  }

  // 2. actionName
  const actionName = actionNameInput.value;

  // 3. data
  let data;
  const dataStr = dataInput.value;
  try {
    data = JSON.parse(dataStr);
  } catch (e) {
    data = dataStr;
  }

  // 4. custom config
  const config = {
    timeout: 3 * 1000,
    targetOrigin: targetOrigin,
    // isIgnoreReturn: true // default false, always wait response until timeout!
  };

  // 5. send and get response
  let outputContent;
  try {
    const responseFromIframe = await windowLinker.send(
      targetWindow,
      actionName,
      data,
      config
    );

    if (typeof responseFromIframe === 'string') {
      outputContent = responseFromIframe;
    } else {
      outputContent = JSON.stringify(responseFromIframe);
    }

  } catch (err) {
    outputContent = 'error! ' + err.message;
  }
  responseDataOutput.value = outputContent;

};
