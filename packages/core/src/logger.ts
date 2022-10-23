class DebugLogger {

    constructor(private readonly enabled: boolean) {
    }

    print(...args: any[]) {
        if (!this.enabled) {
            return;
        }
        const date = new Date();
        const time = ''
            .concat(date.getHours().toString())
            .concat(':')
            .concat(date.getMinutes().toString())
            .concat(':')
            .concat(date.getSeconds().toString())
            .concat('.')
            .concat(date.getMilliseconds().toString());
        const colorStyle = 'color: #FFC0CB';
        console.debug('%c-', colorStyle);
        console.debug('%c╔==[window-linker-log-begin]', colorStyle);
        console.debug(`%c╠== origin: ${window.origin}`, colorStyle);
        console.debug(`%c╠== time: ${time}:`, colorStyle);
        console.debug(...args);
        console.debug('%c╚==[window-linker-log-end]', colorStyle);
        console.debug();
    }
}

export default DebugLogger
