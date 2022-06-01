importScripts('/static/fibfcn.js');


self.addEventListener('message', function (e) {
    const res = fib(e.data);

    self.postMessage(res);
})