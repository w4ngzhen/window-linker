import {WindowLinker} from 'window-linker';

const actionHandlerOutput = document.querySelector('#actionHandlerOutput');

const windowLinker = new WindowLinker({
  enableDebugLog: true
});
windowLinker.init();

windowLinker.listen('echo', data => {
  actionHandlerOutput.value += 'handle "echo" action' + '\r\n';
  actionHandlerOutput.value += 'receive data: ' + JSON.stringify(data) + '\r\n';

  return 'hello: ' + data;
});

windowLinker.listen('formatUser', data => {
  actionHandlerOutput.value += 'handle "formatUser" action' + '\r\n';
  actionHandlerOutput.value += 'receive data: ' + JSON.stringify(data) + '\r\n';

  const {name, id} = data;
  if (!name || !id) {
    const err = new Error('name or id is empty');
    throw err;
    // or you can:
    // return Promise.reject(err);
  }
  const responseData = {
    formatName: `${id}/${name}`,
    timestamp: new Date().getTime()
  };

  return new Promise(resolve => {

    const timer = (time) => {
      if (time <= 0) {
        resolve(responseData);
        return;
      }
      actionHandlerOutput.value += `reply at about ${time}s\r\n`;
      setTimeout(() => {
        timer(time - 1);
      }, 1000);
    };

    timer(5);
  });

});


console.log('hello, child');
